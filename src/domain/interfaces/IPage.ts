import { IElement } from './IElement'

export interface IPage {
  id: string
  name: string
  elements: IElement[]
  background: string
  width: number
  height: number
}
