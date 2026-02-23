import { Document } from 'mongoose'
import { IPage } from './IPage'

export interface ISticker extends Document {
  name: string
  description?: string
  category?: string
  tags?: string[]
  pages: IPage[]           // first page = cover / preview
  svgContent?: string      // pre-rendered SVG string for quick display
  coverImageUrl?: string
  createdBy?: string
  isPublished: boolean
  createdAt?: Date
  updatedAt?: Date
}
