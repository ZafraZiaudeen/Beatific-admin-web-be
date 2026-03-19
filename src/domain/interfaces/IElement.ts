export interface IElement {
  id: string
  type: 'rect' | 'circle' | 'text' | 'image' | 'line' | 'arrow' | 'star' | 'triangle' | 'path' | 'polygon'

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
  numSides?: number
  innerRadius?: number
  outerRadius?: number

  data?: string

  locked?: boolean
  visible?: boolean
  name?: string
  zIndex?: number
}
