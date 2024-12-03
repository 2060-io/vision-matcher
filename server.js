const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { spawn } = require('child_process');
const async = require('async');

const app = express();
const port = 5123;

let cppProcess;
let isReady = false;

function startFaceMatcher() {
    console.log('Starting face_matcher process...');
    // Define the executable path
    const executablePath = './face_matcher/bin/face_matcher';

    // Define the arguments as an array
    const args = [
        '-face_detector_path', 'haarcascade_frontalface_default.xml',
        '-face_matcher_model_path', './face_matcher_model.onnx',
        '-distance_algorithm', 'cosine',
        '-distance_threshold', '0.4'
    ];

    // Spawn the process with the executable and the arguments
    cppProcess = spawn(executablePath, args);

    isReady = false; // Ensure isReady is false before the process is ready

    // Set up event listeners for the C++ process
    cppProcess.on('error', (error) => {
        console.error('Error in face_matcher process: ', error);
    });

    cppProcess.on('exit', (code, signal) => {
        console.error('face_matcher process exited with code: ', code, 'and signal:', signal);
        isReady = false; // Reset readiness when the process exits
        setTimeout(startFaceMatcher, 1000); // Restart the process after a 1 second delay
    });

    // Listen for the READY signal from the C++ process and log output
    cppProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('<<face_matcher output>>:', output);

        if (output.includes('--READY--')) {
            console.log('face_matcher process is ready.');
            isReady = true; // Set isReady to true when the process signals it is ready
        }
    });
}

// Start the face matcher process initially
startFaceMatcher();

app.use(bodyParser.json({ limit: '50mb' }));

// Create a queue with concurrency of 1
const queue = async.queue((task, callback) => {
    const { req, res, tempImage1Path, tempImage2Path, requestId } = task;

    cppProcess.stdin.write(`${requestId},${tempImage1Path},${tempImage2Path}\n`);

    let output = '';
    const dataListener = (data) => {
        output += data.toString();
        if (output.includes('\n')) { // Assuming `\n` signifies the end of output
            cleanUp();

            try {
                const match = output.trim().match(/Response: {distance:(-?\d+(\.\d+)?), requestId:(\d+), match:(true|false)}/);

                if (match) {
                    const distance = parseFloat(match[1]);
                    const responseRequestId = parseInt(match[3], 10);
                    const responseMatch = match[4] === 'true';

                    // Verify that the response matches the current requestId
                    if (responseRequestId === requestId) {
                        res.send({ match: responseMatch, distance: distance, requestId: responseRequestId });
                    } else {
                        console.error('Mismatched requestId:', { expected: requestId, received: responseRequestId });
                        res.status(500).send('Mismatched requestId in face matching process.');
                    }
                } else {
                    console.error('Unexpected output format:', output.trim());
                    res.status(500).send('Error in face matching process: ' + output.trim());
                }

            } catch (err) {
                console.error('Error parsing output:', err);
                res.status(500).send('Error processing face match result.');
            }

            // Cleanup temporary files
            fs.unlinkSync(tempImage1Path);
            fs.unlinkSync(tempImage2Path);

            callback(); // Notify the queue that this task is complete
        }
    };

    function cleanUp() {
        cppProcess.stdout.off('data', dataListener);
    }

    cppProcess.stdout.on('data', dataListener);

}, 1); // Concurrency of 1

queue.drain(() => {
    console.log('All tasks have been processed.');
});

app.post('/face_match', (req, res) => {
    if (!isReady) {
        return res.status(503).send('Service is not ready yet.');
    }

    const requestId = Date.now();
    const image1Base64 = req.body.image1_base64;
    const image2Base64 = req.body.image2_base64;
    const image1Path = req.body.image1_path;
    const image2Path = req.body.image2_path;
    const image1Base64Extension = req.body.image1Base64Extension;
    const image2Base64Extension = req.body.image2Base64Extension;

    // Validate that extension arguments are provided
    if (image1Base64 && (!image1Base64Extension || !["jpg", "jpeg", "png", "jp2"].includes(image1Base64Extension))) {
        return res.status(400).send("Image 1 base64 extension is missing or invalid.");
    }

    if (image2Base64 && (!image2Base64Extension || !["jpg", "jpeg", "png", "jp2"].includes(image2Base64Extension))) {
        return res.status(400).send("Image 2 base64 extension is missing or invalid.");
    }

    // Use the validated extension
    const tempImage1Path = `./temp_img1_${requestId}.${image1Base64Extension}`;
    const tempImage2Path = `./temp_img2_${requestId}.${image2Base64Extension}`;

    try {
        let image1Exists = false;
        let image2Exists = false;

        if (image1Path) {
            if (fs.existsSync(image1Path)) {
                fs.copyFileSync(image1Path, tempImage1Path);
                image1Exists = true;
            } else {
                throw new Error('Image 1 path does not exist.');
            }
        } else if (image1Base64) {
            fs.writeFileSync(tempImage1Path, image1Base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            image1Exists = true;
        }

        if (image2Path) {
            if (fs.existsSync(image2Path)) {
                fs.copyFileSync(image2Path, tempImage2Path);
                image2Exists = true;
            } else {
                throw new Error('Image 2 path does not exist.');
            }
        } else if (image2Base64) {
            fs.writeFileSync(tempImage2Path, image2Base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            image2Exists = true;
        }

        if (!image1Exists || !image2Exists) {
            throw new Error('Both images are required.');
        }

        queue.push({ req, res, tempImage1Path, tempImage2Path, requestId }, (err) => {
            if (err) {
                res.status(500).send('Failed to process the face match request.');
            }
        });

        setTimeout(() => {
            if (queue.length() > 0) {
                console.error('Request timed out:', requestId);
                res.status(504).send('Face matching request timed out.');
            }
        }, 10000);

    } catch (err) {
        console.error(err.message);

        if (fs.existsSync(tempImage1Path)) {
            fs.unlinkSync(tempImage1Path);
        }
        if (fs.existsSync(tempImage2Path)) {
            fs.unlinkSync(tempImage2Path);
        }

        res.status(400).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

process.on('exit', () => {
    if (cppProcess) {
        cppProcess.kill();
    }
});

module.exports = app