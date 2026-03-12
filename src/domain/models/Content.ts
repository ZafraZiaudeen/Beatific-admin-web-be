import { Schema, model } from 'mongoose'
import { IContent } from '../interfaces/IContent'

const ElementSchema = new Schema(
  {
    id:           { type: String, required: true },
    type:         { type: String, required: true },
    x:            { type: Number, required: true },
    y:            { type: Number, required: true },
    width:        Number,
    height:       Number,
    rotation:     Number,
    scaleX:       Number,
    scaleY:       Number,
    fill:         String,
    stroke:       String,
    strokeWidth:  Number,
    opacity:      Number,
    cornerRadius: Number,
    text:         String,
    fontSize:     Number,
    fontFamily:   String,
    fontStyle:    String,
    align:        String,
    lineHeight:   Number,
    letterSpacing:Number,
    src:          String,
    points:       [Number],
    lineCap:      String,
    lineJoin:     String,
    numPoints:    Number,
    innerRadius:  Number,
    outerRadius:  Number,
    data:         String,
    locked:       Boolean,
    visible:      Boolean,
    name:         String,
    zIndex:       Number,
  },
  { _id: false }
)

const PageSchema = new Schema(
  {
    id:         { type: String, required: true },
    name:       { type: String, required: true },
    elements:   { type: [ElementSchema], default: [] },
    background: { type: String, default: '#ffffff' },
    width:      { type: Number, required: true },
    height:     { type: Number, required: true },
  },
  { _id: false }
)

const ContentSchema = new Schema<IContent>(
  {
    name:          { type: String, required: true, trim: true },
    description:   { type: String, trim: true },
    itemType:      { type: String, required: true, trim: true, lowercase: true }, 
    category:      { type: String, trim: true },
    subcategory:   { type: String, trim: true },
    tags:          { type: [String], default: [] },
    pages:         { type: [PageSchema], default: [] },
    svgContent:    String,
    coverImageUrl: String,
    createdBy:     String,
    isPublished:   { type: Boolean, default: false },
  },
  { timestamps: true }
)

ContentSchema.index({ itemType: 1, category: 1, isPublished: 1 })
ContentSchema.index({ itemType: 1, isPublished: 1 })
ContentSchema.index({ name: 'text', description: 'text' })

export const Content = model<IContent>('Content', ContentSchema)
