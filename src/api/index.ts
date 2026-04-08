import { Router } from 'express'
import templateRoutes      from './routes/templateRoutes'
import stickerRoutes       from './routes/stickerRoutes'
import contentRoutes       from './routes/contentRoutes'
import mediaRoutes         from './routes/mediaRoutes'
import authRoutes          from './routes/authRoutes'
import pdfRoutes           from './routes/pdfRoutes'
import categoryRoutes      from './routes/categoryRoutes'
import mainCategoryRoutes  from './routes/mainCategoryRoutes'
import permissionRoutes    from './routes/permissionRoutes'
import userRoutes          from './routes/userRoutes'
import settingsRoutes      from './routes/settingsRoutes'
import dashboardRoutes     from './routes/dashboardRoutes'
import calendarScheduleRoutes from './routes/calendarScheduleRoutes'

const apiRouter = Router()

apiRouter.use('/auth',            authRoutes)
apiRouter.use('/content',         contentRoutes)       
apiRouter.use('/templates',       templateRoutes)   
apiRouter.use('/stickers',        stickerRoutes)      
apiRouter.use('/media',           mediaRoutes)
apiRouter.use('/pdf',             pdfRoutes)
apiRouter.use('/main-categories', mainCategoryRoutes) 
apiRouter.use('/categories',      categoryRoutes)      
apiRouter.use('/permissions',     permissionRoutes)    
apiRouter.use('/users',           userRoutes)
apiRouter.use('/settings',        settingsRoutes)
apiRouter.use('/dashboard',       dashboardRoutes)
apiRouter.use('/calendar-schedules', calendarScheduleRoutes)

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', api: 'v1', time: new Date().toISOString() })
})

export default apiRouter
