import { Router } from 'express'
import path from 'path'
import { upload } from '../../infrastructure/storage/upload'
import { MediaService } from '../../application/mediaService'
import type { Request, Response, NextFunction } from 'express'

const router   = Router()
const mediaSvc = new MediaService()

router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' })
      }
      const info = await mediaSvc.processUpload(req, req.file)
      res.status(201).json({ success: true, data: info })
    } catch (err) { next(err) }
  }
)

router.post(
  '/upload-multiple',
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[]
      if (!files?.length) {
        return res.status(400).json({ success: false, message: 'No files uploaded' })
      }
      const infos = await mediaSvc.processMultipleUploads(req, files)
      res.status(201).json({ success: true, data: infos })
    } catch (err) { next(err) }
  }
)

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = mediaSvc.getMediaList()
    const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`
    const data    = files.map(f => ({
      filename: f,
      url: `${baseUrl}/uploads/${f}`,
    }))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.delete('/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = path.basename(req.params.filename)
    await mediaSvc.deleteMedia(filename)
    res.json({ success: true, message: 'File deleted' })
  } catch (err) { next(err) }
})

export default router
