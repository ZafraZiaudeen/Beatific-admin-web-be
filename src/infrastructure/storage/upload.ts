import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { Request } from 'express'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ALLOWED = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  const ext     = path.extname(file.originalname).toLowerCase()
  if (ALLOWED.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`File type ${ext} is not allowed. Allowed: ${ALLOWED.join(', ')}`))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },  
})

export function buildFileUrl(req: Request, filename: string): string {
  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT }`
  return `${baseUrl}/uploads/${filename}`
}

export function deleteFile(filename: string): void {
  const filepath = path.join(UPLOAD_DIR, filename)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}
