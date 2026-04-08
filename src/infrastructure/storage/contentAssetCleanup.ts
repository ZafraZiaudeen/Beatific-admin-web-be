import { Content } from '../../domain/models/Content'
import { Template } from '../../domain/models/Template'
import { deleteFromCloudinary } from './cloudinary'

type CloudinaryResourceType = 'image' | 'raw' | 'video'

type CloudinaryAssetRef = {
  publicId: string
  resourceType: CloudinaryResourceType
}

type SourceDocument = unknown

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toResourceType(value: string): CloudinaryResourceType | null {
  if (value === 'image' || value === 'raw' || value === 'video') {
    return value
  }

  return null
}

function looksLikeTransformationSegment(value: string): boolean {
  return (
    value.includes(',') ||
    value.startsWith('t_') ||
    value.startsWith('$') ||
    /^[a-z]{1,3}_.+/i.test(value)
  )
}

function extractCloudinaryAsset(url: string): CloudinaryAssetRef | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname !== 'res.cloudinary.com') return null

    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))

    if (segments.length < 4) return null

    const resourceType = toResourceType(segments[1] ?? '')
    if (!resourceType) return null

    let publicIdSegments = segments.slice(3)
    if (!publicIdSegments.length) return null

    const versionIndex = publicIdSegments.findIndex((segment) => /^v\d+$/.test(segment))
    if (versionIndex >= 0) {
      publicIdSegments = publicIdSegments.slice(versionIndex + 1)
    } else {
      while (publicIdSegments.length > 1 && looksLikeTransformationSegment(publicIdSegments[0] ?? '')) {
        publicIdSegments = publicIdSegments.slice(1)
      }
    }

    if (!publicIdSegments.length) return null

    const publicIdWithExtension = publicIdSegments.join('/')
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '')
    if (!publicId) return null

    return {
      publicId,
      resourceType,
    }
  } catch {
    return null
  }
}

function walkStrings(
  value: unknown,
  visit: (text: string) => void,
  seen = new Set<unknown>()
): void {
  if (typeof value === 'string') {
    visit(value)
    return
  }

  if (value === null || value === undefined) return
  if (seen.has(value)) return
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      walkStrings(item, visit, seen)
    }
    return
  }

  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      walkStrings(nested, visit, seen)
    }
  }
}

function collectCloudinaryAssets(source: SourceDocument): CloudinaryAssetRef[] {
  const refs = new Map<string, CloudinaryAssetRef>()

  walkStrings(source, (value) => {
    const asset = extractCloudinaryAsset(value)
    if (!asset) return
    refs.set(`${asset.resourceType}:${asset.publicId}`, asset)
  })

  return Array.from(refs.values())
}

function assetKey(asset: CloudinaryAssetRef): string {
  return `${asset.resourceType}:${asset.publicId}`
}

async function hasOtherReferences(
  asset: CloudinaryAssetRef,
  options: { sourceKind: 'content' | 'template'; sourceId: string }
): Promise<boolean> {
  const [contentDocs, templateDocs] = await Promise.all([
    Content.find(
      options.sourceKind === 'content' ? { _id: { $ne: options.sourceId } } : {},
      { coverImageUrl: 1, pages: 1, svgContent: 1 }
    ).lean(),
    Template.find(
      options.sourceKind === 'template' ? { _id: { $ne: options.sourceId } } : {},
      { coverImageUrl: 1, pages: 1 }
    ).lean(),
  ])

  const targetKey = assetKey(asset)

  for (const doc of [...contentDocs, ...templateDocs]) {
    if (collectCloudinaryAssets(doc).some((ref) => assetKey(ref) === targetKey)) {
      return true
    }
  }

  return false
}

export async function deleteCloudinaryAssetsForDeletedSource(
  source: SourceDocument | null | undefined,
  options: { sourceKind: 'content' | 'template'; sourceId: string }
): Promise<void> {
  const assets = collectCloudinaryAssets(source)
  if (!assets.length) return

  for (const asset of assets) {
    try {
      const shared = await hasOtherReferences(asset, options)
      if (shared) continue

      await deleteFromCloudinary(asset.publicId, asset.resourceType)
    } catch (err: any) {
      console.warn(
        `[cloudinary-cleanup] Failed to delete asset ${asset.publicId}:`,
        err?.message ?? err
      )
    }
  }
}
