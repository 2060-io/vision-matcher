const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { spawn } = require('child_process');
const async = require('async');
const axios = require('axios');
const path = require('path');
const { URL } = require('url');


async function downloadImage(url, filePath) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, response.data);
}

function isDataUrl(url) {
    return url.startsWith('data:image');
}


// Function to create and configure the express application
function createApp(config) {
    const app = express();
    const port = 5123; // default port

    let cppProcess; // child process for the face matcher
    let isReady = false; // flag to track readiness of the matcher

    // Function to start the face matching process
    function startFaceMatcher() {
        console.log('Starting face_matcher process...');

        // Prepare arguments for the executable
        const args = Object.entries(config.arguments).flatMap(entry => ['-' + entry[0], entry[1]]);

        // Spawn the child process for the face matcher
        cppProcess = spawn(config.executablePath, args);
        isReady = false;

        // Event listeners for the child process
        cppProcess.on('error', (error) => {
            console.error('Error in face_matcher process: ', error);
        });

        cppProcess.on('exit', (code, signal) => {
            console.error('face_matcher process exited with code:', code, 'and signal:', signal);
            isReady = false;
            setTimeout(startFaceMatcher, 1000); // Restart the process after a delay
        });

        // Handle data from stdout to check readiness
        cppProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('<<face_matcher output>>:', output);

            if (output.includes('--READY--')) {
                console.log('face_matcher process is ready.');
                isReady = true; // Set readiness when the process signals it
            }
        });
    }

    // Start the face matcher process initially
    startFaceMatcher();
    app.use(bodyParser.json({ limit: '50mb' })); // set request body size limit

    // Async queue to handle requests sequentially (concurrency = 1)
    const queue = async.queue((task, callback) => {
        const { req, res, tempImage1Path, tempImage2Path, requestId } = task;

        // Write request data to the face matcher process
        cppProcess.stdin.write(`${requestId},${tempImage1Path},${tempImage2Path}\n`);

        let output = '';
        const dataListener = (data) => {
            output += data.toString();
            if (output.includes('\n')) {
                cleanUp();

                try {
                    // Parse output to respond correctly
                    const match = output.trim().match(/Response: {distance:(-?\d+(\.\d+)?), requestId:(\d+), match:(true|false)}/);

                    if (match) {
                        const distance = parseFloat(match[1]);
                        const responseRequestId = parseInt(match[3], 10);
                        const responseMatch = match[4] === 'true';

                        // Check if requestId matches
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
                } finally {

                // Cleanup temporary files
                fs.unlinkSync(tempImage1Path);
                fs.unlinkSync(tempImage2Path);

                callback(); // Notify queue that the task is complete
                }
            }
        };

        function cleanUp() {
            cppProcess.stdout.off('data', dataListener);
        }

        cppProcess.stdout.on('data', dataListener);

    }, 1);

    queue.drain(() => {
        console.log('All tasks have been processed.');
    });

    
    // Define the /face_match endpoint
    app.post('/face_match', async (req, res) => {
        if (!isReady) {
            return res.status(503).send('Service is not ready yet.');
        }
        const requestId = Date.now();
        let image1Url = req.body.image1_url; // Assume these fields are provided now
        let image2Url = req.body.image2_url;
    
        const tempImage1Path = `./temp_img1_${requestId}.jpg`; // Default extension, can be modified
        const tempImage2Path = `./temp_img2_${requestId}.jpg`;
    
        try {
            let image1Exists = false;
            let image2Exists = false;
    
            // Process Image 1
            if (image1Url) {
                const imageUrl = new URL(image1Url);
                if (imageUrl.protocol.startsWith('http')) {
                    await downloadImage(image1Url, tempImage1Path);
                    image1Exists = true;
                } else if (imageUrl.protocol === 'file:') {
                    fs.copyFileSync(imageUrl.pathname, tempImage1Path);
                    image1Exists = true;
                } else if (isDataUrl(image1Url)) {
                    const base64Data = image1Url.replace(/^data:image\/\w+;base64,/, '');
                    fs.writeFileSync(tempImage1Path, base64Data, 'base64');
                    image1Exists = true;
                } else {
                    throw new Error('Unsupported URL protocol for Image 1.');
                }
            }
    
            // Process Image 2
            if (image2Url) {
                const imageUrl = new URL(image2Url);
                if (imageUrl.protocol.startsWith('http')) {
                    await downloadImage(image2Url, tempImage2Path);
                    image2Exists = true;
                } else if (imageUrl.protocol === 'file:') {
                    fs.copyFileSync(imageUrl.pathname, tempImage2Path);
                    image2Exists = true;
                } else if (isDataUrl(image2Url)) {
                    const base64Data = image2Url.replace(/^data:image\/\w+;base64,/, '');
                    fs.writeFileSync(tempImage2Path, base64Data, 'base64');
                    image2Exists = true;
                } else {
                    throw new Error('Unsupported URL protocol for Image 2.');
                }
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

    const server = app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });

    server.on('close', () => {
        console.log("Server Close...");
        if (cppProcess) {
            console.log("Closing Face Matcher child process...");
            cppProcess.kill();
        }

    });
    process.on('exit', () => {
        if (cppProcess) {
            cppProcess.kill();
        }
    });

    return server;
}

// Function to start the server with a specified configuration
function startServer(configPath) {
    const config = require(configPath);
    return createApp(config);
}

// If the script is run directly (e.g., `node server.js`), start the server with the default config
if (require.main === module) {
    startServer('./server_config.json');
}

module.exports = startServer;