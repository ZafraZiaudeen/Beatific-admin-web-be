import { Router } from 'express'
import templateRoutes from './routes/templateRoutes'
import stickerRoutes  from './routes/stickerRoutes'
import mediaRoutes    from './routes/mediaRoutes'
import authRoutes     from './routes/authRoutes'

const apiRouter = Router()

apiRouter.use('/auth',      authRoutes)
apiRouter.use('/templates', templateRoutes)
apiRouter.use('/stickers',  stickerRoutes)
apiRouter.use('/media',     mediaRoutes)

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', api: 'v1', time: new Date().toISOString() })
})

export default apiRouter
