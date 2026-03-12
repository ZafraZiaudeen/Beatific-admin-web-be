import path from 'path'
import fs from 'fs'
import { 
  buildFileUrl, 
  deleteFile, 
  USE_CLOUDINARY, 
  uploadFileToCloud, 
  deleteFileFromCloud 
} from '../infrastructure/storage/upload'
import type { Request } from 'express'

export interface UploadedFileInfo {
  filename: string
  originalName: string
  mimetype: string
  size: number
  url: string
  publicId?: string 
}

export class MediaService {

  async processUpload(req: Request, file: Express.Multer.File): Promise<UploadedFileInfo> {
    if (USE_CLOUDINARY) {
      const { url, publicId } = await uploadFileToCloud(file, 'beatific/media')
      return {
        filename: publicId.split('/').pop() ?? publicId,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url,
        publicId,
      }
    }
    
    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: buildFileUrl(req, file.filename),
    }
  }

  async processMultipleUploads(req: Request, files: Express.Multer.File[]): Promise<UploadedFileInfo[]> {
    return Promise.all(files.map(f => this.processUpload(req, f)))
  }

  async deleteMedia(filenameOrPublicId: string): Promise<void> {
    if (USE_CLOUDINARY) {
      await deleteFileFromCloud(filenameOrPublicId)
    } else {
      deleteFile(filenameOrPublicId)
    }
  }

  getMediaList(uploadsDir?: string): string[] {
    if (USE_CLOUDINARY) {
      console.warn('getMediaList is not supported for Cloudinary storage')
      return []
    }
    
    const dir = uploadsDir ?? path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter(f => !f.startsWith('.'))
  }
}
