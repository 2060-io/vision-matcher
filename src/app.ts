import express, { Application, Request, Response } from 'express'
import bodyParser from 'body-parser'
import async from 'async'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import fs from 'fs'
import config from './config'
import { FaceMatchRequest, FaceMatchResponse, Task } from './interfaces'
import { log, warn, error } from './utils/logger'
import { cleanUpFiles, processImage } from './utils/imagesProcessor'

// NEW: protocol transport for Unix sockets
import { UnixSocketTransport } from './ipc/unix_socket_transport'
import { ProtocolHandler, ProtocolMessageType } from './ipc/protocol_handler'

export function createApp(): Application {
  const app = express()

  // 1. Start / monitor C++ matcher
  let cppProcess: ChildProcessWithoutNullStreams
  let isReady = false

  // protocol transport instances
  let transport: UnixSocketTransport | null = null
  let protocol: ProtocolHandler | null = null

  async function waitForSocket(path: string, timeoutMs = 30000) {
    const start = Date.now()
    while (!fs.existsSync(path)) {
      if (Date.now() - start > timeoutMs) throw new Error(`Timeout waiting for socket at ${path}`)
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  async function connectProtocol(): Promise<void> {
    const socketPath = config.arguments.socket_path
    if (!socketPath) throw new Error('config.arguments.socket_path is required')
    await waitForSocket(socketPath)
    transport = new UnixSocketTransport(socketPath)
    await transport.connect()
    protocol = new ProtocolHandler(transport)
    log('Connected to face_matcher via Unix socket')

    // Expect a JSON {"ready":true} once connected
    try {
      const msg = await protocol.recvMessage()
      if (msg && msg.type === ProtocolMessageType.Json) {
        const obj = JSON.parse(msg.data)
        if (obj && obj.ready) {
          isReady = true
          log('face_matcher READY (protocol)')
        }
      }
    } catch (e) {
      error('Error waiting for READY message:', e)
    }
  }

  function teardownProtocol() {
    try {
      transport?.close()
    } catch { /* ignore */ }
    transport = null
    protocol = null
    isReady = false
  }

  function startFaceMatcher() {
    log('Starting face_matcher process…')
    const args = Object.entries(config.arguments).flatMap(([k, v]) => [`-${k}`, v])
    cppProcess = spawn(config.executablePath, args)

    isReady = false

    cppProcess.on('error', (err) => error('face_matcher error:', err))

    cppProcess.stderr.on('data', (err) => {
      error('face_matcher error:', err)
      cppProcess.kill('SIGTERM')
      teardownProtocol()
      queue.kill()
      queue = createQueue()
    })

    cppProcess.on('exit', (code, sig) => {
      error(`face_matcher exited (code=${code}, signal=${sig}) – restarting`)
      teardownProtocol()
      setTimeout(async () => {
        try {
          startFaceMatcher()
        } catch (e) {
          error('Restart failed:', e)
        }
      }, 1_000)
    })

    // optional: still log stdout from native (diagnostics)
    cppProcess.stdout.on('data', (buf) => {
      const out = buf.toString().trim()
      if (out.length) log('<<face_matcher>>', out)
    })

    // establish protocol after socket appears
    connectProtocol().catch((e) => {
      error('Failed to connect protocol:', e)
      cppProcess.kill('SIGTERM')
    })
  }
  startFaceMatcher()

  //2. Middleware
  app.use(bodyParser.json({ limit: '50mb' }))
  log('Express JSON body‑parser registered')

  //3. Async queue
  function createQueue() {
    const _queue = async.queue<Task>(async (task, cb) => {
      const { tempImage1Path, tempImage2Path, requestId, resolve, reject } = task
      log(`[Queue] → matcher  id=${requestId}`)

      try {
        const response = await Promise.race([
          requestFaceMatch(tempImage1Path, tempImage2Path, requestId),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Matcher timeout')), 10_000)),
        ])
        log(`[Queue] ← matcher  id=${requestId}`)
        resolve(response)
      } catch (err) {
        reject(err as Error)
      } finally {
        try { fs.unlinkSync(tempImage1Path) } catch {}
        try { fs.unlinkSync(tempImage2Path) } catch {}
        cb()
      }
    }, 1)

    _queue.drain(() => log('[Queue] All tasks drained'))
    return _queue
  }

  let queue = createQueue()

  async function requestFaceMatch(tempImage1Path: string, tempImage2Path: string, requestId: number): Promise<FaceMatchResponse> {
    if (!protocol) throw new Error('Protocol not connected')
    // Send JSON-only request (C++ will read images from paths)
    await protocol.sendJson({
      requestId,
      image1_path: tempImage1Path,
      image2_path: tempImage2Path,
    })
    // Since queue concurrency is 1, we can wait for the next JSON as the response
    const deadline = Date.now() + 10000 // safety net timeout at this level as well
    while (true) {
      const msg = await protocol.recvMessage()
      if (!msg) throw new Error('Disconnected from matcher')
      if (msg.type === ProtocolMessageType.Json) {
        const obj = JSON.parse(msg.data) as FaceMatchResponse
        if ((obj as any).requestId === requestId) {
          return obj
        }
      }
      if (Date.now() > deadline) throw new Error('Matcher timeout (protocol)')
    }
  }

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
