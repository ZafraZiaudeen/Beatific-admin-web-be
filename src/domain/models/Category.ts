import { Schema, model } from 'mongoose'
import { ICategory } from '../interfaces/ICategory'

const SubcategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
)

const CategorySchema = new Schema<ICategory>(
  {
    name:          { type: String, required: true, trim: true },
    slug:          { type: String, required: true, trim: true, lowercase: true },
    icon:          { type: String, default: '' },
    color:         { type: String, default: 'stone' },
    itemType:      { type: String, required: true, trim: true, lowercase: true },
    subcategories: { type: [SubcategorySchema], default: [] },
    isDefault:     { type: Boolean, default: false },
    order:         { type: Number, default: 0 },
  },
  { timestamps: true }
)

CategorySchema.index({ slug: 1, itemType: 1 }, { unique: true })

export const Category = model<ICategory>('Category', CategorySchema)
