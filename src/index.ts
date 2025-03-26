import { createApp } from './app'

const app = createApp()
const port = process.env.PORT || 5123

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})

server.on('close', () => {
  console.log('Server shutting down...')
})

process.on('exit', () => {
  server.close()
})
