import axios from 'axios'
import fs from 'fs'
import { log, warn, error } from './logger'

/**
 * Downloads an image from a given URL and saves it to a local file.
 *
 * @param {string} url - The URL of the image to download.
 * @param {string} filePath - The path where the image will be saved.
 * @returns {Promise<void>} A promise that resolves when the image has been successfully downloaded.
 */
export async function downloadImage(url: string, filePath: fs.PathOrFileDescriptor): Promise<void> {
  try {
    log(`[downloadImage] Starting image download from: ${url}`)
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    fs.writeFileSync(filePath, res.data)
    log(`[downloadImage] ✔ Image successfully saved → ${filePath}`)
  } catch (err) {
    error('[downloadImage] Error downloading the image', err)
    throw new Error('Failed to download the image.')
  }
}

/**
 * Checks if a given URL is a Data URL (base64 encoded).
 *
 * @param {string} url - The URL to check.
 * @returns {boolean} `true` if the URL is a Data URL, `false` otherwise.
 */
export function isDataUrl(url: string): boolean {
  const yes = url.startsWith('data:image')
  log(`[isDataUrl] ${yes ? '✓' : '×'} ${url.slice(0, 40)}…`)
  return yes
}

/**
 * Deletes the two temporary image files if they exist.
 *
 * @param p1 Path to the first temporary file.
 * @param p2 Path to the second temporary file.
 */
export function cleanUpFiles(p1: string, p2: string): void {
  if (fs.existsSync(p1)) {
    fs.unlinkSync(p1)
    warn(`[cleanUp] removed ${p1}`)
  }
  if (fs.existsSync(p2)) {
    fs.unlinkSync(p2)
    warn(`[cleanUp] removed ${p2}`)
  }
}

/**
 * Processes an image URL and saves it to the specified local file path.
 * Supports HTTP(S), file://, and base64 (data:image) URLs.
 *
 * @param url - The image URL to process.
 * @param destPath - The destination file path where the image will be saved.
 * @throws Will throw an error if the URL protocol is unsupported or if processing fails.
 */
export async function processImage(url: string, destPath: string): Promise<void> {
  try {
    const imageUrl = new URL(url)

    if (imageUrl.protocol.startsWith('http')) {
      log(`[processImage] http(s) → ${destPath}`)
      await downloadImage(url, destPath)
    } else if (imageUrl.protocol === 'file:') {
      log(`[processImage] file:// → ${destPath}`)
      fs.copyFileSync(imageUrl.pathname, destPath)
    } else if (isDataUrl(url)) {
      log(`[processImage] base64 → ${destPath}`)
      const b64 = url.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(destPath, b64, 'base64')
    } else {
      throw new Error(`Unsupported protocol: ${imageUrl.protocol}`)
    }
  } catch (err) {
    error('[processImage] ❌ Failed to process image from URL:', err)
    throw new Error('Unable to process image. Check URL or format.')
  }
}
