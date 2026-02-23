import mongoose from 'mongoose'

let isConnected = false

export async function connectDatabase(): Promise<void> {
  if (isConnected) return

  const uri = process.env.MONGODB_URL ?? process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URL (or MONGODB_URI) environment variable is not set')
  }

  await mongoose.connect(uri)
  isConnected = true
  console.log('MongoDB connected:', mongoose.connection.host)
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return
  await mongoose.disconnect()
  isConnected = false
  console.log('MongoDB disconnected')
}

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err)
  isConnected = false
})

mongoose.connection.on('disconnected', () => {
  isConnected = false
})
