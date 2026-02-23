import path from 'path'
import fs from 'fs'
import { buildFileUrl, deleteFile } from '../infrastructure/storage/upload'
import type { Request } from 'express'

export interface UploadedFileInfo {
  filename: string
  originalName: string
  mimetype: string
  size: number
  url: string
}

export class MediaService {
  processUpload(req: Request, file: Express.Multer.File): UploadedFileInfo {
    return {
      filename:     file.filename,
      originalName: file.originalname,
      mimetype:     file.mimetype,
      size:         file.size,
      url:          buildFileUrl(req, file.filename),
    }
  }

  processMultipleUploads(req: Request, files: Express.Multer.File[]): UploadedFileInfo[] {
    return files.map(f => this.processUpload(req, f))
  }

  deleteMedia(filename: string): void {
    deleteFile(filename)
  }

  getMediaList(uploadsDir?: string): string[] {
    const dir = uploadsDir ?? path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter(f => !f.startsWith('.'))
  }
}
