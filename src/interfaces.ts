/**
 * Configuration used to launch the native **face_matcher** binary.
 *
 * @property {string} executablePath Absolute or relative path to the C++ executable.
 * @property {Record<string, string>} arguments Key‑value map converted to `-flag value` CLI arguments.
 */
export interface Config {
  executablePath: string
  arguments: Record<string, string>
}

/**
 * Work unit placed on the async queue.
 *
 * @property {string}  tempImage1Path Temporary file path of the first image.
 * @property {string}  tempImage2Path Temporary file path of the second image.
 * @property {number}  requestId      Correlation ID used to match stdout lines to the request.
 * @property {(r: FaceMatchResponse) => void} resolve Promise resolver called on success.
 * @property {(e: Error) => void}      reject  Promise rejecter called on failure.
 */
export interface Task {
  tempImage1Path: string
  tempImage2Path: string
  requestId: number
  resolve: (r: FaceMatchResponse) => void
  reject: (e: Error) => void
}

/**
 * JSON object returned to the client after the matcher finishes.
 *
 * @property {boolean} match      `true` if both faces are considered the same person.
 * @property {number}  distance   Numerical distance returned by the model (smaller ⇒ more similar).
 * @property {number}  requestId  Echoes the `requestId` that produced this result.
 */
export interface FaceMatchResponse {
  match: boolean
  distance: number
  requestId: number
  error?: string
}

/**
 * Expected JSON body for **POST /face_match**.
 *
 * @property {string} image1_url URL, `file:` path or `data:image` string of the first picture.
 * @property {string} image2_url URL, `file:` path or `data:image` string of the second picture.
 */
export interface FaceMatchRequest {
  image1_url: string
  image2_url: string
}
