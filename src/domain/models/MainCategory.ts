import { Schema, model } from 'mongoose'
import { IMainCategory } from '../interfaces/IMainCategory'

const MainCategorySchema = new Schema<IMainCategory>(
  {
    name:  { type: String, required: true, trim: true },
    slug:  { type: String, required: true, trim: true, lowercase: true, unique: true },
    icon:  { type: String, default: '' },
    color: { type: String, default: 'stone' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const MainCategory = model<IMainCategory>('MainCategory', MainCategorySchema)
