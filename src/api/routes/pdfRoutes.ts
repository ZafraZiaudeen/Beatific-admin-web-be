import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { importPdf } from '../../application/pdfService'
import { decomposePdf } from '../../application/pdfDecomposeService'

const router = Router()

const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

console.log('[pdfRoutes] USE_CLOUDINARY=', USE_CLOUDINARY)

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

if (!USE_CLOUDINARY && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const pdfStorage = USE_CLOUDINARY
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename:    (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `upload_${uuidv4()}${ext}`)
      },
    })

const pdfFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (ext === '.pdf' || file.mimetype === 'application/pdf') {
    cb(null, true)
  } else {
    cb(new Error('Only PDF files are accepted for import'))
  }
}

const pdfUpload = multer({
  storage:  pdfStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 50 * 1024 * 1024 },   // 50 MB — covers large multi-page planners
})


router.post(
  '/import',
  requireAuth,
  pdfUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    console.log('[pdfRoutes] /import called')
    console.log('[pdfRoutes] req.file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path,
    } : 'undefined')
    
    const uploadedPath = req.file?.path ?? null
    const uploadedBuffer = req.file?.buffer ?? null

    try {
      if (!req.file) {
        console.log('[pdfRoutes] No req.file found')
        res.status(400).json({ success: false, message: 'No PDF file uploaded' })
        return
      }
      
      if (!uploadedPath && !uploadedBuffer) {
        console.log('[pdfRoutes] No path or buffer found in file')
        res.status(400).json({ success: false, message: 'No PDF file uploaded - missing buffer/path' })
        return
      }

      const baseUrl = (
        process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`
      ).replace(/\/+$/, '')

      const fileInput = uploadedBuffer
        ? { buffer: uploadedBuffer, filename: req.file.originalname }
        : uploadedPath!

      const result = await decomposePdf(fileInput, baseUrl)

      if (uploadedPath) {
        try { fs.unlinkSync(uploadedPath) } catch { /* ignore */ }
      }

      res.json({ success: true, data: result })
    } catch (err) {
      if (uploadedPath) {
        try { fs.unlinkSync(uploadedPath) } catch { /* ignore */ }
      }
      next(err)
    }
  },
)

router.post(
  '/decompose',
  requireAuth,
  pdfUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const uploadedPath = req.file?.path ?? null
    const uploadedBuffer = req.file?.buffer ?? null

    try {
      if (!req.file || (!uploadedPath && !uploadedBuffer)) {
        res.status(400).json({ success: false, message: 'No PDF file uploaded' })
        return
      }

      const baseUrl = (
        process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`
      ).replace(/\/+$/, '')

      const dpi = parseInt(req.query.dpi as string) || 150

      const fileInput = uploadedBuffer
        ? { buffer: uploadedBuffer, filename: req.file.originalname }
        : uploadedPath!

      const result = await decomposePdf(fileInput, baseUrl, dpi)

      if (uploadedPath) {
        try { fs.unlinkSync(uploadedPath) } catch { /* ignore */ }
      }

      res.json({ success: true, data: result })
    } catch (err) {
      if (uploadedPath) {
        try { fs.unlinkSync(uploadedPath) } catch { /* ignore */ }
      }
      next(err)
    }
  },
)

router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    console.log('[pdfRoutes] Multer error:', err.message, err.code)
    return res.status(400).json({ success: false, message: `File upload error: ${err.message}` })
  }
  if (err?.message?.includes('Only PDF files')) {
    console.log('[pdfRoutes] File filter rejected:', err.message)
    return res.status(400).json({ success: false, message: err.message })
  }
  next(err)
})

export default router
