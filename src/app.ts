import express, { Application, Request, Response } from 'express'
import bodyParser from 'body-parser'
import async from 'async'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import fs from 'fs'
import { downloadImage, isDataUrl, cleanUpFiles, processImage } from './utils/imagesProcessor'
import config from './config'
import { FaceMatchRequest, FaceMatchResponse, Task } from './interfaces'

export function createApp(): Application {
  const app = express()
  const port = 5123 // Default port

  let cppProcess: ChildProcessWithoutNullStreams
  let isReady = false

  // Start the Face Matcher process
  function startFaceMatcher() {
    console.log('Starting face_matcher process...')
    const args = Object.entries(config.arguments).flatMap(([key, value]) => [`-${key}`, value])
    cppProcess = spawn(config.executablePath, args)

    isReady = false

    cppProcess.on('error', (error) => {
      console.error('Error in face_matcher process:', error)
    })

    cppProcess.on('exit', (code, signal) => {
      console.error('face_matcher process exited with code:', code, 'and signal:', signal)
      isReady = false
      setTimeout(startFaceMatcher, 1000)
    })

    cppProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('<<face_matcher output>>:', output)

      if (output.includes('--READY--')) {
        console.log('face_matcher process is ready.')
        isReady = true
      }
    })
  }

  // Initialize matcher
  startFaceMatcher()

  // Middlewares
  app.use(bodyParser.json({ limit: '50mb' }))

  // Create the queue
  const queue = async.queue((task: Task, callback) => {
    const { res, tempImage1Path, tempImage2Path, requestId } = task

    // Write to stdin for the C++ process
    cppProcess.stdin.write(`${requestId},${tempImage1Path},${tempImage2Path}\n`)

    let output = ''

    // Data listener
    const dataListener = (data: Buffer) => {
      output += data.toString()
      if (output.includes('\n')) {
        cleanUp()

        try {
          const match = output.trim().match(/Response: {distance:(-?\d+(\.\d+)?), requestId:(\d+), match:(true|false)}/)

          if (match) {
            const distance = parseFloat(match[1])
            const responseRequestId = parseInt(match[3], 10)
            const responseMatch = match[4] === 'true'

            const response: FaceMatchResponse = {
              match: responseMatch,
              distance,
              requestId: responseRequestId,
            }

            if (responseRequestId === requestId) {
              res.json(response)
            } else {
              console.error('Mismatched requestId:', { expected: requestId, received: responseRequestId })
              res.status(500).json({ error: 'Mismatched requestId in face matching process.' })
            }
          } else {
            console.error('Unexpected output format:', output.trim())
            res.status(500).json({ error: 'Error in face matching process.' })
          }
        } catch (err) {
          console.error('Error parsing output:', err)
          res.status(500).json({ error: 'Error processing face match result.' })
        }

        // Cleanup temporary images
        fs.unlinkSync(tempImage1Path)
        fs.unlinkSync(tempImage2Path)

        callback()
      }
    }

    function cleanUp() {
      cppProcess.stdout.off('data', dataListener)
    }

    cppProcess.stdout.on('data', dataListener)
  }, 1)

  // When all tasks are done
  queue.drain(() => {
    console.log('All tasks have been processed.')
  })

  // Face Match endpoint
  app.post('/face_match', async (req: Request<{}, {}, FaceMatchRequest>, res: Response): Promise<void> => {
    if (!isReady) {
      res.status(503).json({ error: 'Service is not ready yet.' })
      return
    }

    const requestId = Date.now()
    const { image1_url, image2_url } = req.body

    if (!image1_url || !image2_url) {
      res.status(400).json({ error: 'Both image URLs are required.' })
      return
    }

    const tempImage1Path = `./temp_img1_${requestId}.jpg`
    const tempImage2Path = `./temp_img2_${requestId}.jpg`

    let timeout: NodeJS.Timeout

    try {
      // Download images in parallel
      await Promise.all([processImage(image1_url, tempImage1Path), processImage(image2_url, tempImage2Path)])

      // Push task to the queue
      queue.push({ res, tempImage1Path, tempImage2Path, requestId }, (err) => {
        if (err) {
          console.error('Queue processing error:', err)
          res.status(500).json({ error: 'Failed to process the face match request.' })
          cleanUpFiles(tempImage1Path, tempImage2Path)
        }
      })

      // Set timeout to handle unresponsive requests (10 seconds)
      timeout = setTimeout(() => {
        if (queue.length() > 0) {
          console.error('Request timed out:', requestId)
          res.status(504).json({ error: 'Face matching request timed out.' })
          if (timeout) clearTimeout(timeout)
        }
      }, 10000)
    } catch (error) {
      console.error('Error downloading images:', error)
      res.status(500).json({ error: 'Failed to download images.' })
    } finally {
      cleanUpFiles(tempImage1Path, tempImage2Path)
    }
  })

  return app
}
