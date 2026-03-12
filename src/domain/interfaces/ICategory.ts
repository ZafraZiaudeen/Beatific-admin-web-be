import { Document } from 'mongoose'

export interface ISubcategory {
  name: string
  slug: string
}

export interface ICategory extends Document {
  name:      string
  slug:      string
  icon?:     string
  color:     string
  itemType:  string
  subcategories: ISubcategory[]
  isDefault: boolean
  order:     number
  createdAt?: Date
  updatedAt?: Date
}
