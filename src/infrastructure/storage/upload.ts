import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import type { Request } from 'express'
import { uploadToCloudinary, deleteFromCloudinary } from './cloudinary'

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
}

const USE_CLOUDINARY = isCloudinaryConfigured()

console.log('[upload] Module loaded, USE_CLOUDINARY=', USE_CLOUDINARY, 'CLOUD_NAME=', process.env.CLOUDINARY_CLOUD_NAME ?? '(not set)')

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

if (!USE_CLOUDINARY && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = USE_CLOUDINARY
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
          cb(null, `${crypto.randomUUID()}${ext}`)
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
  limits: { fileSize: Number(process.env.IMAGE_MAX_SIZE_MB ?? process.env.PDF_MAX_SIZE_MB ?? '200') * 1024 * 1024 },  
})

export { USE_CLOUDINARY }

export function buildFileUrl(req: Request, filename: string): string {
  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT}`
  return `${baseUrl}/uploads/${filename}`
}

export function deleteFile(filename: string): void {
  const filepath = path.join(UPLOAD_DIR, filename)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}

export async function uploadFileToCloud(
  file: Express.Multer.File,
  folder?: string
): Promise<{ url: string; publicId: string }> {
  if (!file.buffer) {
    throw new Error('No file buffer available. Memory storage is required for Cloudinary.')
  }
  
  const result = await uploadToCloudinary(file.buffer, {
    folder: folder ?? 'beatific',
    resourceType: 'auto',
  })
  
  return {
    url: result.secureUrl,
    publicId: result.publicId,
  }
}

export async function deleteFileFromCloud(publicId: string): Promise<boolean> {
  return deleteFromCloudinary(publicId)
}
