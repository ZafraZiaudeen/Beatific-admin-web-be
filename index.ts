import 'dotenv/config'


import express from 'express'
import cors from 'cors'
import path from 'path'

import { connectDatabase, disconnectDatabase } from './src/infrastructure/database/connection'
import apiRouter from './src/api/index'
import { USE_CLOUDINARY } from './src/infrastructure/storage/upload'

const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

const JSON_LIMIT = process.env.EXPRESS_JSON_LIMIT ?? '100mb'
app.use(express.json({ limit: JSON_LIMIT }))
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }))

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
app.use('/uploads', express.static(UPLOAD_DIR))

app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    storage: USE_CLOUDINARY ? 'cloudinary' : 'local',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null
  })
})


app.use('/api/v1', apiRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  const status  = err.statusCode ?? err.status ?? 500
  const message = err.message ?? 'Internal Server Error'
  res.status(status).json({ success: false, message })
})

const port = process.env.PORT ?? 3001

async function start() {
  await connectDatabase()

  const server = app.listen(port, () => {
    console.log(`✓ Server running  → http://localhost:${port}`)
    console.log(`✓ API base        → http://localhost:${port}/api/v1`)
  })

  // Allow long-running PDF decompose requests (default 30 min)
  const serverTimeout = Number(process.env.SERVER_TIMEOUT_MS ?? '1800000')
  server.timeout = serverTimeout
  server.keepAliveTimeout = serverTimeout
  server.headersTimeout = serverTimeout + 1000

  server.on('error', (err) => {
    console.error('Server error:', err)
    process.exit(1)
  })

  const gracefulShutdown = async () => {
    console.log('Shutting down gracefully…')
    server.close(async () => {
      await disconnectDatabase()
      console.log('Server closed')
      process.exit(0)
    })
    setTimeout(() => {
      console.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT',  gracefulShutdown)
  process.on('SIGHUP',  gracefulShutdown)
}

start().catch(err => {
  console.error('Startup error:', err)
  process.exit(1)
})
