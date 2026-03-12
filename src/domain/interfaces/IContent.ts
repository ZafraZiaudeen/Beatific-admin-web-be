export interface IElement {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  cornerRadius?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontStyle?: string
  align?: string
  lineHeight?: number
  letterSpacing?: number
  src?: string
  points?: number[]
  lineCap?: string
  lineJoin?: string
  numPoints?: number
  innerRadius?: number
  outerRadius?: number
  data?: string
  locked?: boolean
  visible?: boolean
  name?: string
  zIndex?: number
}

export interface IPage {
  id: string
  name: string
  elements: IElement[]
  background: string
  width: number
  height: number
}

export interface IContent {
  _id?: string
  name: string
  description?: string
  itemType: string 
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
