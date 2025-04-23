import express, { Application, Request, Response } from 'express'
import bodyParser from 'body-parser'
import async from 'async'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import fs from 'fs'
import config from './config'
import { FaceMatchRequest, FaceMatchResponse, Task } from './interfaces'
import { log, warn, error } from './utils/logger'
import { cleanUpFiles, processImage } from './utils/imagesProcessor'

export function createApp(): Application {
  const app = express()

  // 1. Start / monitor C++ matcher
  let cppProcess: ChildProcessWithoutNullStreams
  let isReady = false

  function startFaceMatcher() {
    log('Starting face_matcher process…')
    const args = Object.entries(config.arguments).flatMap(([k, v]) => [`-${k}`, v])
    cppProcess = spawn(config.executablePath, args)

    isReady = false

    cppProcess.on('error', (err) => error('face_matcher error:', err))

    cppProcess.on('exit', (code, sig) => {
      error(`face_matcher exited (code=${code}, signal=${sig}) – restarting`)
      isReady = false
      setTimeout(startFaceMatcher, 1_000)
    })

    cppProcess.stdout.on('data', (buf) => {
      const out = buf.toString().trim()
      log('<<face_matcher>>', out)
      if (out.includes('--READY--')) {
        isReady = true
        log('face_matcher READY')
      }
    })
  }
  startFaceMatcher()

  //2. Middleware
  app.use(bodyParser.json({ limit: '50mb' }))
  log('Express JSON body‑parser registered')

  //3. Async queue
  const queue = async.queue<Task>((task, cb) => {
    const { tempImage1Path, tempImage2Path, requestId, resolve, reject } = task
    log(`[Queue] → matcher  id=${requestId}`)

    cppProcess.stdin.write(`${requestId},${tempImage1Path},${tempImage2Path}\n`)

    let output = ''
    const listener = (buf: Buffer) => {
      output += buf.toString()
      if (output.includes('\n')) {
        cppProcess.stdout.off('data', listener)
        log(`[Queue] ← matcher  id=${requestId}`)

        try {
          const m = output.trim().match(/Response: {distance:(-?\d+(\.\d+)?), requestId:(\d+), match:(true|false)}/)
          if (!m) throw new Error('Regex mismatch')

          const resId = Number(m[3])
          if (resId !== requestId) throw new Error('Mismatched requestId')

          const response: FaceMatchResponse = {
            match: m[4] === 'true',
            distance: parseFloat(m[1]),
            requestId: resId,
          }
          resolve(response)
        } catch (err) {
          reject(err as Error)
        } finally {
          fs.unlinkSync(tempImage1Path)
          fs.unlinkSync(tempImage2Path)
          cb()
        }
      }
    }
    cppProcess.stdout.on('data', listener)
  }, 1)

  queue.drain(() => log('[Queue] All tasks drained'))

  /// Enqueues a task and returns a Promise with the matcher result.
  function enqueueMatch(tempImage1Path: string, tempImage2Path: string, requestId: number): Promise<FaceMatchResponse> {
    return new Promise((resolve, reject) => {
      queue.push({ tempImage1Path, tempImage2Path, requestId, resolve, reject })
    })
  }

  // 4. /face_match route
  app.post('/face_match', async (req: Request<FaceMatchRequest>, res: Response): Promise<void> => {
    if (!isReady) {
      warn('Matcher not ready – 503')
      res.status(503).json({ error: 'Service not ready' })
      return
    }

    const requestId = Date.now()
    const { image1_url, image2_url } = req.body
    log('---- NEW REQUEST ----', requestId)

    if (!image1_url || !image2_url) {
      res.status(400).json({ error: 'Both image URLs are required' })
      return
    }

    const tempImage1Path = `./temp_img1_${requestId}.jpg`
    const tempImage2Path = `./temp_img2_${requestId}.jpg`

    try {
      log('Downloading / copying images…')
      await Promise.all([processImage(image1_url, tempImage1Path), processImage(image2_url, tempImage2Path)])
      log('Images ready on disk')

      const result = await Promise.race([
        enqueueMatch(tempImage1Path, tempImage2Path, requestId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Matcher timeout')), 10_000)),
      ])

      res.json(result)
    } catch (err) {
      error('Face‑match failure:', err)
      res.status(500).json({ error: (err as Error).message })
      cleanUpFiles(tempImage1Path, tempImage2Path)
    }
  })

  return app
}
