const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = 5123;

// Spawn the C++ process when the server starts
const cppProcess = spawn('./face_matcher');

let isReady = false;
let requestCounter = 0; // Initialize the counter

// Set up event listeners for the C++ process
cppProcess.on('error', error => {
    console.error('Error in face_matcher process: ', error);
});
cppProcess.on('exit', code => {
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

app.post('/face_match', (req, res) => {
    if (!isReady) {
        return res.status(503).send('Service is not ready yet.'); // 503: Service Unavailable
    }

    // Increment the counter for each request
    const currentRequestId = requestCounter++;

    const image1Base64 = req.body.image1_base64;
    const image2Base64 = req.body.image2_base64;
    const image1Path = req.body.image1_path;
    const image2Path = req.body.image2_path;

    // Use the counter to create unique temporary file paths
    const tempImage1Path = `./temp_img1_${currentRequestId}.jpg`;
    const tempImage2Path = `./temp_img2_${currentRequestId}.jpg`;

    try {
        if (image1Path) {
            // Use provided path for image 1
            fs.copyFileSync(image1Path, tempImage1Path);
        } else if (image1Base64) {
            // Use provided base64 string for image 1
            fs.writeFileSync(tempImage1Path, image1Base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        } else {
            return res.status(400).send('Image 1 is required.');
        }

        if (image2Path) {
            // Use provided path for image 2
            fs.copyFileSync(image2Path, tempImage2Path);
        } else if (image2Base64) {
            // Use provided base64 string for image 2
            fs.writeFileSync(tempImage2Path, image2Base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        } else {
            return res.status(400).send('Image 2 is required.');
        }

        // Write the paths to the process's stdin
        cppProcess.stdin.write(`${tempImage1Path},${tempImage2Path}\n`);

        // Read data from stdout
        let output = '';
        const dataListener = (data) => {
            output += data.toString();
            // Check if the read data contains a full output (example: expects a newline)
            if (output.includes('\n')) { // assuming `\n` signifies the end of output
                cleanUp();
                const distance = parseFloat(output.trim());
                res.send({ cosineDistance: distance });

                // Cleanup temporary files
                fs.unlinkSync(tempImage1Path);
                fs.unlinkSync(tempImage2Path);
            }
        };

        function cleanUp() {
            cppProcess.stdout.off('data', dataListener);
        }

        cppProcess.stdout.on('data', dataListener);

    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing request.');
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Optional cleanup on server shutdown, such as terminating the C++ process
process.on('exit', () => {
    cppProcess.kill();
});