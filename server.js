const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = 5123;

// Spawn the C++ process when the server starts
const cppProcess = spawn('./face_matcher');

let isReady = false;

// Set up event listeners for the C++ process
cppProcess.on('error', error => {
    console.error('Error in face_matcher process: ', error);
});
cppProcess.on('exit', code => {
    console.error('face_matcher process exited with code: ', code);
    // Optionally, you might want to relaunch it here
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

    const image1Base64 = req.body.image1;
    const image2Base64 = req.body.image2;

    if (!image1Base64 || !image2Base64) {
        return res.status(400).send('Both images are required.');
    }

    try {
        const image1Path = './temp_img1.jpg';
        const image2Path = './temp_img2.jpg';

        fs.writeFileSync(image1Path, image1Base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        fs.writeFileSync(image2Path, image2Base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

        // Write the paths to the process's stdin
        cppProcess.stdin.write(`${image1Path},${image2Path}\n`);

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
                fs.unlinkSync(image1Path);
                fs.unlinkSync(image2Path);
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