import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { randomUUID } from 'crypto'
import { createCanvas } from '@napi-rs/canvas'
import { uploadToCloudinary } from '../infrastructure/storage/cloudinary'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

if (!USE_CLOUDINARY && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}


interface CanvasElement {
  id: string
  type: 'rect' | 'circle' | 'text' | 'image' | 'line' | 'arrow' | 'star' | 'triangle' | 'path' | 'polygon'
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontStyle?: string
  align?: string
  lineHeight?: number
  src?: string
  points?: number[]
  data?: string
  locked?: boolean
  visible?: boolean
  name?: string
  cornerRadius?: number
}

export interface KonvaPage {
  id: string
  name: string
  elements: CanvasElement[]
  background: string
  width: number
  height: number
}


function mapFontFamily(fontName: string): string {
  const n = (fontName ?? '').toLowerCase()
  if (n.includes('helvetica') || n.includes('arial'))  return 'Arial'
  if (n.includes('times'))                              return 'Times New Roman'
  if (n.includes('courier'))                            return 'Courier New'
  if (n.includes('georgia'))                            return 'Georgia'
  if (n.includes('verdana'))                            return 'Verdana'
  if (n.includes('trebuchet'))                          return 'Trebuchet MS'
  if (n.includes('impact'))                             return 'Impact'
  if (n.includes('comic'))                              return 'Comic Sans MS'
  if (n.includes('palatino'))                           return 'Palatino'
  if (n.includes('garamond'))                           return 'Garamond'
  return 'Arial'
}

function getFontStyle(fontName: string): string {
  const n = (fontName ?? '').toLowerCase()
  const bold   = n.includes('bold')
  const italic = n.includes('italic') || n.includes('oblique')
  if (bold && italic) return 'bold italic'
  if (bold)           return 'bold'
  if (italic)         return 'italic'
  return 'normal'
}


function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}


interface TextFragment {
  str: string
  x: number        
  y: number       
  width: number    
  fontSize: number
  fontFamily: string
  fontStyle: string
  fontName: string  
  fill: string
}


function buildFillColorAtPositions(
  ops: any,
  opsById: Record<number, string>,
): Map<string, string> {
  const map = new Map<string, string>()
  let fill = [0, 0, 0]

  for (let i = 0; i < ops.fnArray.length; i++) {
    const op   = opsById[ops.fnArray[i]]
    const args = ops.argsArray[i]

    switch (op) {
      case 'setFillRGBColor':   fill = [args[0], args[1], args[2]]; break
      case 'setFillGray':       fill = [args[0], args[0], args[0]]; break
      case 'setFillCMYKColor': {
        const [c, m, y, k] = args
        fill = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)]
        break
      }
      case 'moveText':
      case 'setTextMatrix': {
        const tx = op === 'moveText' ? args[0] : args[4]
        const ty = op === 'moveText' ? args[1] : args[5]
        if (typeof tx === 'number' && typeof ty === 'number') {
          map.set(`${Math.round(tx)},${Math.round(ty)}`, rgbToHex(fill[0], fill[1], fill[2]))
        }
        break
      }
      default: break
    }
  }
  return map
}


function mergeTextFragments(fragments: TextFragment[]): TextFragment[] {
  if (fragments.length === 0) return []

  interface LineGroup {
    key: string
    items: TextFragment[]
  }

  const groups: LineGroup[] = []

  for (const f of fragments) {
    const yBucket = Math.round(f.y / 2) * 2
    const key = `${yBucket}|${f.fontSize}|${f.fontName}|${f.fill}`
    let group = groups.find(g => g.key === key)
    if (!group) {
      group = { key, items: [] }
      groups.push(group)
    }
    group.items.push(f)
  }

  const merged: TextFragment[] = []

  for (const group of groups) {
    const items = group.items.sort((a, b) => a.x - b.x)

    let current = { ...items[0] }

    for (let i = 1; i < items.length; i++) {
      const next = items[i]
      const endOfCurrent = current.x + current.width
      const gap = next.x - endOfCurrent
      const threshold = current.fontSize * 0.6 

      if (gap < threshold && gap > -current.fontSize * 0.3) {
        const spacer = gap > 2 ? ' ' : ''
        current.str   += spacer + next.str
        current.width  = (next.x + next.width) - current.x
      } else {
        merged.push(current)
        current = { ...next }
      }
    }
    merged.push(current)
  }

  return merged
}


export async function importPdf(
  filePath: string,
  baseUrl: string,
): Promise<KonvaPage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  )
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

  const fileData = new Uint8Array(fs.readFileSync(filePath))

  const pdfDoc = await (
    pdfjsLib.getDocument({
      data:                fileData,
      cMapUrl:             pathToFileURL(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/cmaps')).href + '/',
      cMapPacked:          true,
      standardFontDataUrl: pathToFileURL(path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')).href + '/',
      isEvalSupported:     false,
      disableStream:       true,
      disableAutoFetch:    true,
      useSystemFonts:      true,
    }) as any
  ).promise

  const numPages: number = pdfDoc.numPages
  const pages: KonvaPage[] = []

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pdfPage = await pdfDoc.getPage(pageNum)

    const viewport1x = pdfPage.getViewport({ scale: 1.0 })
    const pageW = Math.round(viewport1x.width)
    const pageH = Math.round(viewport1x.height)

    const RENDER_SCALE = 2.0
    const viewportHR   = pdfPage.getViewport({ scale: RENDER_SCALE })

    const elements: CanvasElement[] = []

    let bgImageSrc: string | null = null
    try {
      const canvas = createCanvas(
        Math.round(viewportHR.width),
        Math.round(viewportHR.height),
      )
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await pdfPage.render({
        canvasContext: ctx as any,   // eslint-disable-line @typescript-eslint/no-explicit-any
        viewport: viewportHR,
      }).promise

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let nonWhite = 0
      const step = Math.max(1, Math.floor(imgData.data.length / (4 * 500))) * 4
      for (let p = 0; p < imgData.data.length; p += step) {
        const r = imgData.data[p], g = imgData.data[p + 1], b = imgData.data[p + 2]
        if (r < 250 || g < 250 || b < 250) nonWhite++
      }

      if (nonWhite > 3) {
        const pngBuffer = canvas.toBuffer('image/png')
        
        if (USE_CLOUDINARY) {
          const result = await uploadToCloudinary(pngBuffer, {
            folder: 'beatific/pdf-backgrounds',
            resourceType: 'image',
          })
          bgImageSrc = result.secureUrl
        } else {
          const pngFilename = `pdf_bg_${randomUUID()}.png`
          fs.writeFileSync(path.join(UPLOAD_DIR, pngFilename), pngBuffer)
          bgImageSrc = `${baseUrl}/uploads/${pngFilename}`
        }
      } else {
        console.warn(`[pdfService] page ${pageNum}: render appears blank, skipping background image`)
      }
    } catch (renderErr) {
      console.warn(`[pdfService] page ${pageNum} render error:`, renderErr)
    }

    if (bgImageSrc) {
      elements.push({
        id:      randomUUID(),
        type:    'image',
        x:       0,
        y:       0,
        width:   pageW,
        height:  pageH,
        src:     bgImageSrc,
        locked:  true,
        opacity: 1,
        name:    'PDF Background',
      })
    }


    let colorMap = new Map<string, string>()
    try {
      const ops = await pdfPage.getOperatorList()
      const OPS = pdfjsLib.OPS as Record<string, number>
      const opsById: Record<number, string> = {}
      for (const [name, code] of Object.entries(OPS)) opsById[code as number] = name
      colorMap = buildFillColorAtPositions(ops, opsById)
    } catch { /* best-effort */ }

    try {
      const textContent = await pdfPage.getTextContent({ includeMarkedContent: false })

      const rawFragments: TextFragment[] = []

      for (const item of textContent.items) {
        if (!item || typeof (item as any).str !== 'string') continue
        const str: string = (item as any).str
        if (!str.trim()) continue

        const transform: number[] = (item as any).transform
        const [a, b, , , tx, ty] = transform

        const fontSize = Math.max(6, Math.round(Math.sqrt(a * a + b * b)))

        const [vx, vy] = viewport1x.convertToViewportPoint(tx, ty)
        const x = Math.round(vx)
        const y = Math.round(vy - fontSize)  

        const fontName   = (item as any).fontName ?? ''
        const fontFamily = mapFontFamily(fontName)
        const fontStyle  = getFontStyle(fontName)
        const itemWidth  = (item as any).width as number | undefined
        const w = itemWidth && itemWidth > 0 ? Math.round(itemWidth) : Math.round(str.length * fontSize * 0.55)

        const posKey = `${Math.round(tx)},${Math.round(ty)}`
        const fill   = colorMap.get(posKey) ?? '#000000'

        rawFragments.push({ str, x, y, width: w, fontSize, fontFamily, fontStyle, fontName, fill })
      }

      const merged = mergeTextFragments(rawFragments)

      for (const frag of merged) {
        elements.push({
          id:         randomUUID(),
          type:       'text',
          x:          frag.x,
          y:          frag.y,
          width:      frag.width + 4,
          fontSize:   frag.fontSize,
          fontFamily: frag.fontFamily,
          fontStyle:  frag.fontStyle,
          fill:       frag.fill,
          text:       frag.str,
          opacity:    1,
          lineHeight: 1.2,
          name:       'Imported Text',
        })
      }
    } catch (textErr) {
      console.warn(`[pdfService] text extraction warning page ${pageNum}:`, textErr)
    }

    pages.push({
      id:         randomUUID(),
      name:       numPages === 1 ? 'Page 1' : `Page ${pageNum}`,
      elements,
      background: '#ffffff',
      width:      pageW,
      height:     pageH,
    })
  }

  return pages
}
