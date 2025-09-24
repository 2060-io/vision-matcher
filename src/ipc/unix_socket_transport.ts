import { Transport } from './transport'
import * as net from 'net'
import { EventEmitter } from 'events'

export class UnixSocketTransport extends EventEmitter implements Transport {
  private socket?: net.Socket
  private buffer: Buffer[] = []
  private bufferLen: number = 0
  private readResolve: ((b: Buffer) => void) | null = null
  private readReject: ((err: any) => void) | null = null
  // NEW: track how many bytes the pending read expects
  private pendingExpected: number | null = null

  constructor(private socketPath: string) {
    super()
  }

  isConnected(): boolean {
    return !!this.socket && !this.socket.destroyed
  }

  async connect(): Promise<void> {
    if (this.socket) throw new Error('Already connected')
    this.socket = net.createConnection(this.socketPath)
    this.socket.on('data', (chunk: Buffer) => {
      this.buffer.push(chunk)
      this.bufferLen += chunk.length
      this._maybeFulfillRead() // will use pendingExpected
    })
    this.socket.on('error', (err) => {
      if (this.readReject) {
        this.readReject(err)
        this.readReject = null
        this.pendingExpected = null
      }
      this.emit('error', err)
    })
    this.socket.on('close', () => {
      if (this.readReject) {
        this.readReject(new Error('Socket closed'))
        this.readReject = null
        this.pendingExpected = null
      }
      this.emit('close')
    })
    await new Promise<void>((resolve, reject) => {
      this.socket!.once('connect', resolve)
      this.socket!.once('error', reject)
    })
  }

  close() {
    if (this.socket) {
      this.socket.destroy()
    }
  }

  async read(n: number): Promise<Buffer> {
    if (n === 0) return Buffer.alloc(0)
    if (this.bufferLen >= n) {
      return this._drainBuffer(n)
    }
    // Wait for enough data
    return new Promise<Buffer>((resolve, reject) => {
      this.readResolve = resolve
      this.readReject = reject
      this.pendingExpected = n
      this._maybeFulfillRead()
    })
  }

  private _maybeFulfillRead() {
    const expected = this.pendingExpected
    if (!this.readResolve || expected == null) return
    if (expected === 0) return // never fulfill 0-length reads spuriously
    if (this.bufferLen >= expected) {
      const res = this._drainBuffer(expected)
      const resolve = this.readResolve
      this.readResolve = null
      this.readReject = null
      this.pendingExpected = null
      resolve(res)
    }
  }

  private _drainBuffer(count: number): Buffer {
    if (count === 0) return Buffer.alloc(0)
    let out: Buffer
    if (this.buffer.length > 0 && this.buffer[0].length === count) {
      out = this.buffer.shift() as Buffer
    } else if (this.buffer.length > 0 && this.buffer[0].length > count) {
      out = this.buffer[0].subarray(0, count)
      this.buffer[0] = this.buffer[0].subarray(count)
    } else {
      let total = 0
      const bufs: Buffer[] = []

      while (total < count && this.buffer.length > 0) {
        const need = count - total
        const b = this.buffer[0]
        if (b.length <= need) {
          bufs.push(this.buffer.shift() as Buffer)
          total += b.length
        } else {
          bufs.push(b.subarray(0, need))
          this.buffer[0] = b.subarray(need)
          total += need
        }
      }
      out = Buffer.concat(bufs, count)
    }
    this.bufferLen -= count
    return out
  }

  async write(buf: Buffer): Promise<void> {
    if (!this.socket || this.socket.destroyed) throw new Error('Socket is closed')
    return new Promise<void>((resolve, reject) => {
      this.socket!.write(buf, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
