import fs from 'fs'
import { log } from './logger'

/**
 * Checks if a file's size in KB exceeds the given limit.
 *
 * @param filePath Absolute or relative path to the file.
 * @param maxKB    Max allowed size in KB.
 * @returns `true` if the file is bigger than maxKB, otherwise `false`.
 */
export function isImageOverLimit(filePath: string, maxKB: number): boolean {
  const fileSizeBytes = fs.statSync(filePath).size
  const fileSizeKB = Math.ceil(fileSizeBytes / 1024)

  log(`[isImageOverLimit] file=${filePath}, size=${fileSizeKB} KB, limit=${maxKB} KB`)

  return fileSizeKB > maxKB
}
