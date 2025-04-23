type LogFn = (...args: unknown[]) => void

/**
 * Factory that creates a timestamp‑prefixed logger.
 *
 * @param tag  Emoji or string label to visually distinguish the log level.
 * @param base Console method to delegate to (`console.log`, `console.warn`, etc.).
 * @returns    A function with the same signature as `console.log`.
 */
function makeLogger(tag: string, base: LogFn): LogFn {
  return (...args: unknown[]) => base(new Date().toISOString(), tag, ...args)
}

export const log = makeLogger('🛈', console.log)
export const warn = makeLogger('⚠️ ', console.warn)
export const error = makeLogger('🛑', console.error)
