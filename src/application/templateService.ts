import mongoose from 'mongoose'
import { Template } from '../domain/models/Template'
import { DeletedTemplateSnapshot } from '../domain/models/DeletedTemplateSnapshot'
import { ITemplate } from '../domain/interfaces/ITemplate'
import { IPage } from '../domain/interfaces/IPage'
import { getAppConnection } from '../infrastructure/database/appConnection'
import { deleteCloudinaryAssetsForDeletedSource } from '../infrastructure/storage/contentAssetCleanup'

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

export interface DeleteTemplateOptions {
  keepForExistingJournals?: boolean
  deletedBy?: string
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

export interface AdminDeleteResult {
  deleted: boolean
  templateId: string
  snapshotCreated: boolean
  journalRefCount: number
  journalsRemoved: number
  preserveForUsers: boolean
}

export class TemplateService {
  private async deleteTemplateFromAppDb(id: string): Promise<void> {
    const appConn = await getAppConnection()
    if (!appConn) return
    try {
      const AppTemplate =
        appConn.models.Template ?? appConn.model<ITemplate>('Template', Template.schema)
      await AppTemplate.findByIdAndDelete(id)
    } catch (err: any) {
      console.warn('[app-db] Failed to delete template:', err?.message ?? err)
    }
  }

  private async snapshotTemplateForJournals(template: ITemplate, deletedBy?: string): Promise<void> {
    if (!template?._id) return
    const appConn = await getAppConnection()
    if (!appConn) return

    try {
      const templateId = String((template as any)._id ?? template._id)
      const journalRefCount = await appConn.collection('journals').countDocuments({ templateId })

      await appConn.collection('deletedtemplatesnapshots').updateOne(
        { sourceTemplateId: templateId },
        {
          $set: {
            sourceTemplateId: templateId,
            snapshot: {
              ...((template as any).toObject ? (template as any).toObject() : template),
              _id: templateId,
            },
            deletedAt: new Date(),
            deletedBy,
            journalRefCount,
          },
        },
        { upsert: true }
      )
    } catch (err: any) {
      console.warn('[app-db] Failed to create deleted template snapshot:', err?.message ?? err)
    }
  }

  private async purgeTemplateReferences(templateId: string): Promise<void> {
    const appConn = await getAppConnection()
    if (!appConn) return
    try {
      await Promise.all([
        appConn.collection('deletedtemplatesnapshots').deleteMany({ sourceTemplateId: templateId }),
        appConn.collection('journals').deleteMany({ templateId }),
      ])
    } catch (err: any) {
      console.warn('[app-db] Failed to purge template references:', err?.message ?? err)
    }
  }

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
    return Template.findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after', runValidators: true })
  }

  async delete(id: string, options?: DeleteTemplateOptions): Promise<boolean> {
    const existing = await Template.findById(id)
    if (!existing) return false

    if (options?.keepForExistingJournals) {
      await this.snapshotTemplateForJournals(existing, options.deletedBy)
    } else {
      await Promise.all([
        this.purgeTemplateReferences(String(existing._id)),
        deleteCloudinaryAssetsForDeletedSource(existing, {
          sourceKind: 'template',
          sourceId: String(existing._id),
        }),
      ])
    }

    const result = await Template.findByIdAndDelete(id)
    if (result) await this.deleteTemplateFromAppDb(id)
    return result !== null
  }

  async savePages(id: string, pages: IPage[]): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $set: { pages } }, { returnDocument: 'after' })
  }

  async addPage(id: string, page: IPage): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $push: { pages: page } }, { returnDocument: 'after' })
  }

  async publish(id: string, isPublished: boolean): Promise<ITemplate | null> {
    return Template.findByIdAndUpdate(id, { $set: { isPublished } }, { returnDocument: 'after' })
  }
}
