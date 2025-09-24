import { Transport } from './transport'
import { EventEmitter } from 'events'

export type ImageData = { rows: number; cols: number; data: Buffer }
export type CombinedImage = { id: number; img: ImageData }

export enum ProtocolMessageType {
  Image = 0x01,
  Json = 0x02,
  Combined = 0x03,
}

export class ProtocolHandler extends EventEmitter {
  transport: Transport

  constructor(transport: Transport) {
    super()
    this.transport = transport
  }

  // Send a single image message (0x01)
  async sendImage(img: ImageData): Promise<void> {
    const { rows, cols, data } = img
    const header = Buffer.alloc(1 + 4 + 4 + 4)
    header.writeUInt8(ProtocolMessageType.Image, 0)
    header.writeUInt32BE(data.length, 1)
    header.writeUInt32BE(rows, 5)
    header.writeUInt32BE(cols, 9)
    await this.transport.write(header)
    await this.transport.write(data)
  }

  // Send a single JSON message (0x02)
  async sendJson(obj: any): Promise<void> {
    const payload = Buffer.from(JSON.stringify(obj), 'utf8')
    const header = Buffer.alloc(1 + 4)
    header.writeUInt8(ProtocolMessageType.Json, 0)
    header.writeUInt32BE(payload.length, 1)
    await this.transport.write(header)
    await this.transport.write(payload)
  }

  // Send a combined message (0x03)
  async sendCombined(images: CombinedImage[], jsonObj: any): Promise<void> {
    const imagesCount = images.length
    const jsonStr = typeof jsonObj === 'string' ? jsonObj : JSON.stringify(jsonObj)
    const jsonBuf = Buffer.from(jsonStr, 'utf8')
    const header = Buffer.alloc(1 + 4)
    header.writeUInt8(ProtocolMessageType.Combined, 0)
    header.writeUInt32BE(imagesCount, 1)
    await this.transport.write(header)

    // Send each image: id | size | rows | cols | data
    for (const { id, img } of images) {
      const blockHeader = Buffer.alloc(4 + 4 + 4 + 4)
      blockHeader.writeUInt32BE(id, 0)
      blockHeader.writeUInt32BE(img.data.length, 4)
      blockHeader.writeUInt32BE(img.rows, 8)
      blockHeader.writeUInt32BE(img.cols, 12)
      await this.transport.write(blockHeader)
      await this.transport.write(img.data) // Buffer
    }
    // Write JSON
    const jsonHdr = Buffer.alloc(4)
    jsonHdr.writeUInt32BE(jsonBuf.length, 0)
    await this.transport.write(jsonHdr)
    await this.transport.write(jsonBuf)
  }

  // Read one protocol message and emit event, or return info
  // Event: 'image', 'json', or 'combined'
  async recvMessage(): Promise<{ type: ProtocolMessageType; data: any } | null> {
    const fidBuf = await this.transport.read(1)
    if (!fidBuf || fidBuf.length === 0) return null
    const fid = fidBuf.readUInt8(0)

    if (fid === ProtocolMessageType.Image) {
      const hdr = await this.transport.read(12)
      const size = hdr.readUInt32BE(0)
      const rows = hdr.readUInt32BE(4)
      const cols = hdr.readUInt32BE(8)

      const imgBuf = await this.transport.read(size)
      const img: ImageData = { rows, cols, data: imgBuf }
      this.emit('image', img)
      return { type: ProtocolMessageType.Image, data: img }
    } else if (fid === ProtocolMessageType.Json) {
      const sizeBuf = await this.transport.read(4)
      const size = sizeBuf.readUInt32BE(0)
      const jsonBuf = await this.transport.read(size)
      const s = jsonBuf.toString('utf8')
      this.emit('json', s)
      return { type: ProtocolMessageType.Json, data: s }
    } else if (fid === ProtocolMessageType.Combined) {
      const countBuf = await this.transport.read(4)
      const imagesCount = countBuf.readUInt32BE(0)
      const images: CombinedImage[] = []
      for (let i = 0; i < imagesCount; ++i) {
        const imgHeader = await this.transport.read(16)
        const img_id = imgHeader.readUInt32BE(0)
        const img_size = imgHeader.readUInt32BE(4)
        const rows = imgHeader.readUInt32BE(8)
        const cols = imgHeader.readUInt32BE(12)

        const imgBuf = await this.transport.read(img_size)
        images.push({
          id: img_id,
          img: { rows, cols, data: imgBuf },
        })
      }
      const jsonLenBuf = await this.transport.read(4)
      const jsonLen = jsonLenBuf.readUInt32BE(0)
      const jsonBuf = await this.transport.read(jsonLen)
      const s = jsonBuf.toString('utf8')
      this.emit('combined', { images, json: s })
      return { type: ProtocolMessageType.Combined, data: { images, json: s } }
    } else {
      // Unknown, ignore
      return { type: fid, data: null }
    }
  }
}
