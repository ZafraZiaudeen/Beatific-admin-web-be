

import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { Agent } from 'undici'
import type { KonvaPage } from './pdfService'
import { importPdf as legacyImportPdf } from './pdfService'

const PDF_DECOMPOSER_URL = process.env.PDF_DECOMPOSER_URL ?? 'http://localhost:5050'

const decomposerAgent = new Agent({
  connectTimeout: 30_000,       
  headersTimeout: 0,             
  bodyTimeout: 0,               
  keepAliveTimeout: 120_000,   
  keepAliveMaxTimeout: 600_000,  
  connections: 4,                
})

const HEALTH_TTL_MS = Number(process.env.PDF_HEALTH_TTL_MS ?? '30000')
let _lastHealthCheck: { ok: boolean; ts: number } | null = null

const BACKGROUND_TIMEOUT_MS = Number(process.env.PDF_BACKGROUND_TIMEOUT_MS ?? '1800000')

const JOB_TTL_MS = Number(process.env.PDF_JOB_TTL_MS ?? '1800000')

const JOB_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

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


export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface DecomposeJob {
  id: string
  status: JobStatus
  progress: number        // 0-100
  totalPages: number      // estimated
  message: string
  result: DecomposeResult | null
  error: string | null
  createdAt: number
  completedAt: number | null
}

const _jobs = new Map<string, DecomposeJob>()

setInterval(() => {
  const now = Date.now()
  for (const [id, job] of _jobs) {
    const age = now - job.createdAt
    if (age > JOB_TTL_MS) {
      _jobs.delete(id)
    }
  }
}, JOB_CLEANUP_INTERVAL_MS)



async function isPythonServiceAvailable(): Promise<boolean> {
  if (_lastHealthCheck && (Date.now() - _lastHealthCheck.ts) < HEALTH_TTL_MS) {
    return _lastHealthCheck.ok
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${PDF_DECOMPOSER_URL}/health`, {
      signal: controller.signal,
      // @ts-ignore - undici dispatcher option is available at runtime
      dispatcher: decomposerAgent,
    })
    clearTimeout(timeout)
    const ok = res.ok
    _lastHealthCheck = { ok, ts: Date.now() }
    return ok
  } catch {
    _lastHealthCheck = { ok: false, ts: Date.now() }
    return false
  }
}



async function callPythonDecomposer(
  fileInput: string | { buffer: Buffer; filename: string },
  dpi: number = 150,
  timeoutMs: number = BACKGROUND_TIMEOUT_MS,
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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      // @ts-ignore - undici dispatcher option is available at runtime
      dispatcher: decomposerAgent,
    })
  } finally {
    clearTimeout(timer)
  }

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

  return mapDecomposeResponse(json.data)
}



function mapDecomposeResponse(data: { pages: any[]; fonts: any[] }): DecomposeResult {
  const pages: KonvaPage[] = data.pages.map((p: any) => {
    const elements = (p.elements ?? [])
      .map((el: any) => ({
        id: el.id ?? randomUUID(),
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
      id: p.id ?? randomUUID(),
      name: p.name ?? 'Page',
      elements,
      background: p.background ?? '#ffffff',
      width: p.width,
      height: p.height,
    }
  })

  const fonts: FontInfo[] = (data.fonts ?? []).map((f: any) => ({
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


export function startDecomposeJob(
  fileInput: { buffer: Buffer; filename: string },
  dpi: number = 150,
): string {
  const jobId = randomUUID()

  const job: DecomposeJob = {
    id: jobId,
    status: 'pending',
    progress: 0,
    totalPages: 0,
    message: 'Upload received, starting decomposition…',
    result: null,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
  }
  _jobs.set(jobId, job)

  ;(async () => {
    try {
      job.status = 'processing'
      job.message = 'Sending PDF to decomposer service…'
      job.progress = 5

      const pythonAvailable = await isPythonServiceAvailable()
      if (!pythonAvailable) {
        throw new Error('Python PDF decomposer service is unavailable')
      }

      job.message = 'Decomposing PDF (this may take a while for large documents)…'
      job.progress = 10

      const result = await callPythonDecomposer(
        fileInput,
        dpi,
        BACKGROUND_TIMEOUT_MS,
      )

      job.result = result
      job.totalPages = result.pages.length
      job.progress = 100
      job.status = 'complete'
      job.message = `Successfully decomposed ${result.pages.length} pages`
      job.completedAt = Date.now()

      console.log(`[pdfDecomposeService] Job ${jobId} complete: ${result.pages.length} pages in ${((job.completedAt - job.createdAt) / 1000).toFixed(1)}s`)
    } catch (err: any) {
      job.status = 'failed'
      job.error = err?.message ?? 'Unknown decomposition error'
      job.message = `Decomposition failed: ${job.error}`
      job.completedAt = Date.now()
      console.error(`[pdfDecomposeService] Job ${jobId} failed:`, err?.message ?? err)
    }
  })()

  return jobId
}


export function getJob(jobId: string): DecomposeJob | null {
  return _jobs.get(jobId) ?? null
}


export function removeJob(jobId: string): void {
  _jobs.delete(jobId)
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
