import axios from 'axios'
import fs from 'fs'

/**
 * Downloads an image from a given URL and saves it to a local file.
 *
 * @param {string} url - The URL of the image to download.
 * @param {string} filePath - The path where the image will be saved.
 * @returns {Promise<void>} A promise that resolves when the image has been successfully downloaded.
 */
export async function downloadImage(url: string, filePath: fs.PathOrFileDescriptor) {
  try {
    console.log(`Starting image download from: ${url}`)
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    fs.writeFileSync(filePath, response.data)
    console.log(`Image successfully saved to: ${filePath}`)
  } catch (error) {
    console.error('Error downloading the image:', error)
    throw new Error('Failed to download the image.')
  }
}

/**
 * Checks if a given URL is a Data URL (base64 encoded).
 *
 * @param {string} url - The URL to check.
 * @returns {boolean} `true` if the URL is a Data URL, `false` otherwise.
 */
export function isDataUrl(url: string) {
  const isData = url.startsWith('data:image')
  console.log(`URL checked: ${url}, isDataUrl: ${isData}`)
  return isData
}

// Define cleanup function in this scope so it is accessible everywhere
export function cleanUpFiles(tempImage1Path: string, tempImage2Path: string) {
  if (fs.existsSync(tempImage1Path)) fs.unlinkSync(tempImage1Path)
  if (fs.existsSync(tempImage2Path)) fs.unlinkSync(tempImage2Path)
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
      await downloadImage(url, destPath)
    } else if (imageUrl.protocol === 'file:') {
      fs.copyFileSync(imageUrl.pathname, destPath)
    } else if (isDataUrl(url)) {
      const base64Data = url.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(destPath, base64Data, 'base64')
    } else {
      throw new Error(`Unsupported URL protocol: ${imageUrl.protocol}`)
    }
  } catch (error) {
    console.error(`[processImage] Failed to process image from URL: ${url}`)
    throw new Error('Unable to process image. Please check the URL or format.')
  }
}
