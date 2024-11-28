const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { spawn } = require('child_process');
const async = require('async');

const app = express();
const port = 5123;

// Spawn the C++ process when the server starts
const cppProcess = spawn('./face_matcher');

let isReady = false;

// Set up event listeners for the C++ process
cppProcess.on('error', (error) => {
    console.error('Error in face_matcher process: ', error);
});
cppProcess.on('exit', (code) => {
    console.error('face_matcher process exited with code: ', code);
    // Optionally, you might want to retry launching it here
});

// Listen for the READY signal from the C++ process and log output
cppProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('<<face_matcher output>>:', output);

    if (output.includes('--READY--')) {
        isReady = true;
    }
});

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
                const match = output.trim().match(/Response: {cosineDistance:(-?\d+(\.\d+)?), requestId:(\d+)}/);

                if (match) {
                    const distance = parseFloat(match[1]);
                    const responseRequestId = parseInt(match[3], 10);

                    // Verify that the response matches the current requestId
                    if (responseRequestId === requestId) {
                        res.send({ cosineDistance: distance, requestId: responseRequestId });
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

    const requestId = Date.now(); // Use the current timestamp as a unique requestId
    const image1Base64 = req.body.image1_base64;
    const image2Base64 = req.body.image2_base64;
    const image1Path = req.body.image1_path;
    const image2Path = req.body.image2_path;

    const tempImage1Path = `./temp_img1_${requestId}.jpg`;
    const tempImage2Path = `./temp_img2_${requestId}.jpg`;

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
            // Check if the task is still in the queue and respond with a timeout error
            if (queue.length() > 0) {
                console.error('Request timed out:', requestId);
                res.status(504).send('Face matching request timed out.');
            }
        }, 10000); // Timeout after 10 seconds

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
    cppProcess.kill();
});