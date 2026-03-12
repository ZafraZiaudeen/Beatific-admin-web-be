import { Document } from 'mongoose'

export interface IMainCategory extends Document {
  name:      string
  slug:      string
  icon?:     string
  color:     string
  order:     number
  createdAt?: Date
  updatedAt?: Date
}
