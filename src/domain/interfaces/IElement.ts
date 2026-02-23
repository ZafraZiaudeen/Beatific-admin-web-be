export interface IElement {
  id: string
  type: 'rect' | 'circle' | 'text' | 'image' | 'line' | 'arrow' | 'star' | 'triangle' | 'path'

  // position & transform
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  scaleX?: number
  scaleY?: number

  // style
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  cornerRadius?: number

  // text
  text?: string
  fontSize?: number
  fontFamily?: string
  fontStyle?: string
  align?: string
  lineHeight?: number
  letterSpacing?: number

  // image
  src?: string

  // line / arrow
  points?: number[]
  lineCap?: string
  lineJoin?: string

  // star
  numPoints?: number
  innerRadius?: number
  outerRadius?: number

  // path
  data?: string

  // meta
  locked?: boolean
  visible?: boolean
  name?: string
  zIndex?: number
}
