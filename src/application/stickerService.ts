import { Sticker } from '../domain/models/Sticker'
import { ISticker } from '../domain/interfaces/ISticker'
import { IPage } from '../domain/interfaces/IPage'

export interface CreateStickerDto {
  name: string
  description?: string
  category?: string
  tags?: string[]
  pages: IPage[]
  svgContent?: string
  coverImageUrl?: string
  createdBy?: string
}

export interface UpdateStickerDto {
  name?: string
  description?: string
  category?: string
  tags?: string[]
  pages?: IPage[]
  svgContent?: string
  coverImageUrl?: string
  isPublished?: boolean
}

export interface ListStickersQuery {
  category?: string
  tags?: string
  isPublished?: string
  page?: string
  limit?: string
  search?: string
}

export class StickerService {
  async create(dto: CreateStickerDto): Promise<ISticker> {
    const sticker = new Sticker(dto)
    return sticker.save()
  }

  async list(query: ListStickersQuery): Promise<{
    data: ISticker[]
    total: number
    page: number
    limit: number
  }> {
    const filter: Record<string, unknown> = {}

    if (query.category) filter.category = query.category

    if (query.tags) {
      filter.tags = { $in: query.tags.split(',').map(t => t.trim()) }
    }

    if (query.isPublished !== undefined) {
      filter.isPublished = query.isPublished === 'true'
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ]
    }

    const page  = Math.max(1, parseInt(query.page  ?? '1',  10))
    const limit = Math.min(100, parseInt(query.limit ?? '20', 10))
    const skip  = (page - 1) * limit

    const [data, total] = await Promise.all([
      Sticker.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Sticker.countDocuments(filter),
    ])

    return { data: data as unknown as ISticker[], total, page, limit }
  }

  async getById(id: string): Promise<ISticker | null> {
    return Sticker.findById(id)
  }

  async update(id: string, dto: UpdateStickerDto): Promise<ISticker | null> {
    return Sticker.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
  }

  async delete(id: string): Promise<boolean> {
    const result = await Sticker.findByIdAndDelete(id)
    return result !== null
  }

  async savePages(id: string, pages: IPage[], svgContent?: string): Promise<ISticker | null> {
    const update: Record<string, unknown> = { pages }
    if (svgContent !== undefined) update.svgContent = svgContent
    return Sticker.findByIdAndUpdate(id, { $set: update }, { new: true })
  }

  async publish(id: string, isPublished: boolean): Promise<ISticker | null> {
    return Sticker.findByIdAndUpdate(id, { $set: { isPublished } }, { new: true })
  }
}
