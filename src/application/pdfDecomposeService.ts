

import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { KonvaPage } from './pdfService'
import { importPdf as legacyImportPdf } from './pdfService'

const PDF_DECOMPOSER_URL = process.env.PDF_DECOMPOSER_URL ?? 'http://localhost:5050'

export interface FontInfo {
  name: string
  originalName: string
  family: string
  style: string
  bold: boolean
  italic: boolean
  embeddedFile: string | null
}

export interface DecomposeResult {
  pages: KonvaPage[]
  fonts: FontInfo[]
}


async function isPythonServiceAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${PDF_DECOMPOSER_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}


async function callPythonDecomposer(
  fileInput: string | { buffer: Buffer; filename: string },
  dpi: number = 150,
): Promise<DecomposeResult> {
  let fileBuffer: Buffer
  let fileName: string

  if (typeof fileInput === 'string') {
    fileBuffer = fs.readFileSync(fileInput)
    fileName = path.basename(fileInput)
  } else {
    fileBuffer = fileInput.buffer
    fileName = fileInput.filename
  }

  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: 'application/pdf' })
  formData.append('file', blob, fileName)

  const url = `${PDF_DECOMPOSER_URL}/api/decompose?dpi=${dpi}&include_raster_background=0&extract_vectors=1`

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Python decomposer returned ${response.status}: ${errorText}`)
  }

  const json = (await response.json()) as {
    success: boolean
    message?: string
    data?: { pages: any[]; fonts: any[] }
  }

  if (!json.success || !json.data) {
    throw new Error(json.message ?? 'Python decomposer returned unsuccessful response')
  }

  const pages: KonvaPage[] = json.data.pages.map((p: any) => {
    const elements = (p.elements ?? [])
      .map((el: any) => ({
        id: el.id ?? uuidv4(),
        type: el.type,
        x: el.x ?? 0,
        y: el.y ?? 0,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth,
        opacity: el.opacity ?? 1,
        text: el.text,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontStyle: el.fontStyle,
        align: el.align,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing,
        src: el.src,
        points: el.points,
        data: el.data,
        lineCap: el.lineCap,
        lineJoin: el.lineJoin,
        numPoints: el.numPoints,
        innerRadius: el.innerRadius,
        outerRadius: el.outerRadius,
        numSides: el.numSides,
        dash: el.dash,
        locked: el.locked ?? false,
        visible: el.visible ?? true,
        name: el.name,
        cornerRadius: el.cornerRadius,
        zIndex: el.zIndex,
      }))
      .sort((a: any, b: any) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

    return {
      id: p.id ?? uuidv4(),
      name: p.name ?? 'Page',
      elements,
      background: p.background ?? '#ffffff',
      width: p.width,
      height: p.height,
    }
  })

  const fonts: FontInfo[] = (json.data.fonts ?? []).map((f: any) => ({
    name: f.name,
    originalName: f.originalName,
    family: f.family ?? f.name,
    style: f.style,
    bold: f.bold ?? false,
    italic: f.italic ?? false,
    embeddedFile: f.embeddedFile,
  }))

  return { pages, fonts }
}


export async function decomposePdf(
  fileInput: string | { buffer: Buffer; filename: string },
  baseUrl: string,
  dpi: number = 150,
): Promise<DecomposeResult> {
  const pythonAvailable = await isPythonServiceAvailable()

  if (pythonAvailable) {
    console.log('[pdfDecomposeService] Using Python decomposer')
    return await callPythonDecomposer(fileInput, dpi)
  }

  if (typeof fileInput === 'string') {
    console.log('[pdfDecomposeService] Python decomposer unavailable, using legacy import')
    const pages = await legacyImportPdf(fileInput, baseUrl)
    return { pages, fonts: [] }
  } else {
    throw new Error('Python PDF decomposer service is unavailable and legacy fallback requires a file path')
  }
}
