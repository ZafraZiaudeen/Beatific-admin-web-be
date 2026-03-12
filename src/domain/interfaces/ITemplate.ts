import { Document } from 'mongoose'
import { IPage } from './IPage'

export interface ITemplate extends Document {
  name: string
  description?: string
  category?: string
  subcategory?: string
  tags?: string[]
  pages: IPage[]
  coverImageUrl?: string
  createdBy?: string
  isPublished: boolean
  createdAt?: Date
  updatedAt?: Date
}
