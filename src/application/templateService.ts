import { Template } from '../domain/models/Template'
import { ITemplate } from '../domain/interfaces/ITemplate'
import { IPage } from '../domain/interfaces/IPage'

export interface CreateTemplateDto {
  name: string
  description?: string
  category?: string
  subcategory?: string
  tags?: string[]
  pages: IPage[]
  coverImageUrl?: string
  createdBy?: string
  isPublished?: boolean
}

export interface UpdateTemplateDto {
  name?: string
  description?: string
  category?: string
  subcategory?: string
  tags?: string[]
  pages?: IPage[]
  coverImageUrl?: string
  isPublished?: boolean
}

export interface ListTemplatesQuery {
  category?: string
  subcategory?: string
  tags?: string
  isPublished?: string
  page?: string
  limit?: string
  search?: string
}

export class TemplateService {
  async create(dto: CreateTemplateDto): Promise<ITemplate> {
    const template = new Template({ isPublished: true, ...dto })
    return template.save()
  }

  async list(query: ListTemplatesQuery): Promise<{
    data: ITemplate[]
    total: number
    page: number
    limit: number
  }> {
    const filter: Record<string, unknown> = {}

    if (query.category) filter.category = query.category

    if (query.subcategory) filter.subcategory = query.subcategory

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
      Template.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Template.countDocuments(filter),
    ])

    return { data: data as unknown as ITemplate[], total, page, limit }
  }

  async getById(id: string): Promise<ITemplate | null> {
    return Template.findById(id)
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
  }

  async delete(id: string): Promise<boolean> {
    const result = await Template.findByIdAndDelete(id)
    return result !== null
  }

  async savePages(id: string, pages: IPage[]): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $set: { pages } }, { new: true })
  }

  async addPage(id: string, page: IPage): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $push: { pages: page } }, { new: true })
  }

  async publish(id: string, isPublished: boolean): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $set: { isPublished } }, { new: true })
  }
}
