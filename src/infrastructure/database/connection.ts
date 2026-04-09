import mongoose from 'mongoose'

let isConnected = false

function resolveMongoUri(): string | undefined {
  // Support local/dev naming and common Railway Mongo variables.
  return (
    process.env.MONGODB_URL ??
    process.env.MONGODB_URI ??
    process.env.MONGO_PRIVATE_URL ??
    process.env.MONGO_URL ??
    process.env.MONGO_PUBLIC_URL
  )
}

export async function connectDatabase(): Promise<void> {
  if (isConnected) return

  const uri = resolveMongoUri()
  if (!uri) {
    throw new Error(
      'MongoDB connection env var is not set. Expected one of: MONGODB_URL, MONGODB_URI, MONGO_PRIVATE_URL, MONGO_URL, MONGO_PUBLIC_URL'
    )
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
