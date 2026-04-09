import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { randomUUID } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { importPdf } from '../../application/pdfService'
import { decomposePdf, startDecomposeJob, getJob, removeJob } from '../../application/pdfDecomposeService'

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

const PDF_MAX_SIZE_MB = Number(process.env.PDF_MAX_SIZE_MB ?? '200')
const PDF_MAX_SIZE    = PDF_MAX_SIZE_MB * 1024 * 1024

const PDF_REQUEST_TIMEOUT_MS = Number(process.env.PDF_REQUEST_TIMEOUT_MS ?? '300000')

const pdfStorage = USE_CLOUDINARY
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename:    (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `upload_${randomUUID()}${ext}`)
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
  storage:    pdfStorage,
  fileFilter: pdfFilter,
  limits:     { fileSize: PDF_MAX_SIZE },
})


router.post(
  '/import',
  requireAuth,
  pdfUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    console.log('[pdfRoutes] /import called')
    const uploadedPath = req.file?.path ?? null
    const uploadedBuffer = req.file?.buffer ?? null

    req.setTimeout(PDF_REQUEST_TIMEOUT_MS)
    res.setTimeout(PDF_REQUEST_TIMEOUT_MS)

    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No PDF file uploaded' })
        return
      }
      
      if (!uploadedPath && !uploadedBuffer) {
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

      const dpi = parseInt(req.query.dpi as string) || 150

      let buffer: Buffer
      if (uploadedBuffer) {
        buffer = uploadedBuffer
      } else {
        buffer = fs.readFileSync(uploadedPath!)
        try { fs.unlinkSync(uploadedPath!) } catch { /* ignore */ }
      }

      const jobId = startDecomposeJob(
        { buffer, filename: req.file.originalname },
        dpi,
      )

      res.json({
        success: true,
        jobId,
        message: 'PDF upload accepted. Decomposition started in background.',
      })
    } catch (err) {
      if (uploadedPath) {
        try { fs.unlinkSync(uploadedPath) } catch { /* ignore */ }
      }
      next(err)
    }
  },
)



router.get(
  '/job/:jobId',
  requireAuth,
  (req: Request, res: Response) => {
    const job = getJob(req.params.jobId)

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found or expired',
      })
      return
    }

    if (job.status === 'complete' && job.result) {
      res.json({
        success: true,
        status:     job.status,
        progress:   job.progress,
        totalPages: job.totalPages,
        message:    job.message,
        data:       job.result,
        elapsed:    job.completedAt ? job.completedAt - job.createdAt : null,
      })
      return
    }

    if (job.status === 'failed') {
      res.json({
        success: false,
        status:   job.status,
        progress: job.progress,
        message:  job.message,
        error:    job.error,
        elapsed:  job.completedAt ? job.completedAt - job.createdAt : null,
      })
      return
    }

    res.json({
      success: true,
      status:     job.status,
      progress:   job.progress,
      totalPages: job.totalPages,
      message:    job.message,
    })
  },
)



router.delete(
  '/job/:jobId',
  requireAuth,
  (req: Request, res: Response) => {
    removeJob(req.params.jobId)
    res.json({ success: true, message: 'Job removed' })
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
