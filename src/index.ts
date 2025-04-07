import { createApp } from './app'
import { log } from './utils/logger'

const app = createApp()
const port = process.env.PORT || 5123

const server = app.listen(port, () => {
  log(`Server is running on http://localhost:${port}`)
})

server.on('close', () => {
  log('Server shutting down...')
})

process.on('exit', () => {
  server.close()
})
