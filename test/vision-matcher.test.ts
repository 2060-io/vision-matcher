import path from 'path'
import request from 'supertest'
import { createApp } from '../src/app'

jest.setTimeout(60_000)

const app = createApp()

//Build a file:// URL to a fixture under test/assets.

const asset = (name: string) => 'file://' + path.resolve(__dirname, 'assets', name)

// Wait for the matcher to be ready by polling the endpoint
async function waitForMatcherReady(timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await request(app)
      .post('/face_match')
      .send({
        image1_url: asset('angelina1.jpeg'),
        image2_url: asset('angelina2.jpeg'),
      })

    if (res.status !== 503) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Matcher did not become ready within 30 seconds')
}

beforeAll(async () => {
  await waitForMatcherReady()
})

afterAll(async () => {
  await (app as any).close?.()
})

describe('POST /face_match', () => {
  it('returns a positive match (angelina1 vs angelina2)', async () => {
    const res = await request(app)
      .post('/face_match')
      .send({
        image1_url: asset('angelina1.jpeg'),
        image2_url: asset('angelina2.jpeg'),
      })

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('distance')
    expect(typeof res.body.distance).toBe('number')
    expect(res.body).toHaveProperty('requestId')
    expect(typeof res.body.requestId).toBe('number')
    expect(res.body.match).toBe(true)
  })

  it('returns a negative match (angelina1 vs salma)', async () => {
    const res = await request(app)
      .post('/face_match')
      .send({
        image1_url: asset('angelina1.jpeg'),
        image2_url: asset('salma.jpeg'),
      })

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('distance')
    expect(typeof res.body.distance).toBe('number')
    expect(res.body.match).toBe(false)
  })
})
