import { v2 as cloudinary, UploadApiResponse } from 'cloudinary'
import { Readable } from 'stream'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface CloudinaryUploadResult {
  publicId: string
  url: string
  secureUrl: string
  format: string
  width?: number
  height?: number
  bytes: number
}

export async function uploadToCloudinary(
  buffer: Buffer,
  options?: {
    folder?: string
    publicId?: string
    resourceType?: 'image' | 'raw' | 'video' | 'auto'
  }
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options?.folder ?? 'beatific',
        public_id: options?.publicId,
        resource_type: options?.resourceType ?? 'auto',
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`))
        } else if (result) {
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          })
        } else {
          reject(new Error('Cloudinary upload returned no result'))
        }
      }
    )

    const readable = new Readable()
    readable.push(buffer)
    readable.push(null)
    readable.pipe(uploadStream)
  })
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    })
    return result.result === 'ok'
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    return false
  }
}

export function getCloudinaryUrl(
  publicId: string,
  options?: {
    width?: number
    height?: number
    crop?: string
    quality?: number | string
  }
): string {
  return cloudinary.url(publicId, {
    secure: true,
    width: options?.width,
    height: options?.height,
    crop: options?.crop ?? 'fill',
    quality: options?.quality ?? 'auto',
  })
}

export { cloudinary }
