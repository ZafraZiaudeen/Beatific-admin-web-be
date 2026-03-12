import { Document } from 'mongoose'
import { IPage } from './IPage'

export interface ISticker extends Document {
  name: string
  description?: string
  category?: string
  subcategory?: string
  tags?: string[]
  pages: IPage[]          
  svgContent?: string     
  coverImageUrl?: string
  createdBy?: string
  isPublished: boolean
  createdAt?: Date
  updatedAt?: Date
}
