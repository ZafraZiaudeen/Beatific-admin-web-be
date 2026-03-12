import mongoose from 'mongoose'

let appConnection: mongoose.Connection | null = null

export async function getAppConnection(): Promise<mongoose.Connection | null> {
  if (appConnection && appConnection.readyState === 1) {
    return appConnection
  }

  const uri = process.env.APP_MONGODB_URI
  if (!uri) {
    console.warn('[app-db] APP_MONGODB_URI environment variable is not set.');
    return null;
  }

  try {
    appConnection = await mongoose.createConnection(uri).asPromise()
    console.log('[app-db] Connected to app database:', uri.split('/').pop())

    appConnection.on('error', (err: Error) => {
      console.error('[app-db] Connection error:', err)
      appConnection = null
    })

    appConnection.on('disconnected', () => {
      console.warn('[app-db] Disconnected from app database')
      appConnection = null
    })

    return appConnection
  } catch (err) {
    console.warn('[app-db] Could not connect to app database — app user management will be unavailable:', (err as Error).message)
    return null
  }
}

export async function closeAppConnection(): Promise<void> {
  if (appConnection) {
    await appConnection.close()
    appConnection = null
  }
}
