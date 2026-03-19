import mongoose from 'mongoose'
import { Content } from '../domain/models/Content'
import { DeletedContentSnapshot } from '../domain/models/DeletedContentSnapshot'
import { IContent } from '../domain/interfaces/IContent'
import { emailService } from '../infrastructure/email/emailService'
import { settingsService } from './settingsService'

export interface CreateContentDto {
  name: string
  description?: string
  itemType: string  // 'template', 'sticker', 'planner', etc.
  category?: string
  subcategory?: string
  tags?: string[]
  pages?: object[]
  svgContent?: string
  coverImageUrl?: string
  createdBy?: string
  isPublished?: boolean
}

export interface UpdateContentDto {
  name?: string
  description?: string
  category?: string
  subcategory?: string
  tags?: string[]
  coverImageUrl?: string
  isPublished?: boolean
}

export interface AdminDeleteResult {
  deleted: boolean
  contentId: string
  snapshotCreated: boolean
  journalRefCount: number
  journalsRemoved: number
  preserveForUsers: boolean
}

export class ContentService {
  async create(dto: CreateContentDto): Promise<IContent> {
    const content = new Content(dto)
    return content.save()
  }

  async list(params: {
    itemType?: string
    category?: string
    subcategory?: string
    search?: string
    isPublished?: boolean
  }): Promise<{ data: IContent[]; total: number }> {
    // Build query filter
    const filter: Record<string, unknown> = {}
    
    if (params.itemType) filter.itemType = params.itemType
    if (params.category) filter.category = params.category
    if (params.subcategory) filter.subcategory = params.subcategory
    if (params.isPublished !== undefined) filter.isPublished = params.isPublished
    
    if (params.search) {
      filter.$text = { $search: params.search }
    }

    const data = await Content.find(filter)
      .sort({ updatedAt: -1 })
      .lean() as IContent[]
    
    return { data, total: data.length }
  }

  async getById(id: string): Promise<IContent | null> {
    return Content.findById(id)
  }

  async update(id: string, dto: UpdateContentDto): Promise<IContent | null> {
    return Content.findByIdAndUpdate(
      id,
      { $set: dto },
      { returnDocument: 'after', runValidators: true }
    )
  }

  async savePages(id: string, pages: object[], svgContent?: string): Promise<IContent | null> {
    const update: Record<string, unknown> = { pages }
    if (svgContent !== undefined) update.svgContent = svgContent
    
    return Content.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: 'after' }
    )
  }

  async publish(id: string, isPublished: boolean): Promise<IContent | null> {
    const content = await Content.findByIdAndUpdate(
      id,
      { $set: { isPublished } },
      { returnDocument: 'after' }
    )

    if (content && isPublished) {
      const settings = await settingsService.get()
      if (settings.enableEmailNotifications && settings.notifyOnContentPublish) {
        emailService.send({
          to: settings.supportEmail || undefined,
          subject: `[Beatific Admin] Content Published: ${content.name}`,
          text: `New content was just published to the app.\n\nName: ${content.name}\nType: ${content.itemType}\nCategory: ${content.category || 'N/A'}\nTime: ${new Date().toISOString()}`,
        }).catch((err: any) => console.warn('[Email] Failed to send publish notification:', err.message))
      }
    }

    return content
  }

  async delete(id: string, deletedBy?: string, preserveForUsers = true): Promise<AdminDeleteResult> {
    const content = await Content.findById(id).lean()
    if (!content) {
      return {
        deleted: false,
        contentId: id,
        snapshotCreated: false,
        journalRefCount: 0,
        journalsRemoved: 0,
        preserveForUsers,
      }
    }

  
    const journalsCollection = mongoose.connection.collection('journals')
    const journalRefCount = await journalsCollection.countDocuments({ templateId: id })

    const session = await mongoose.startSession().catch(() => null)

    try {
      if (session) {
        session.startTransaction()
      }

      const sessionOpts = session ? { session } : {}

      let snapshotCreated = false
      let journalsRemoved = 0
      if (preserveForUsers && journalRefCount > 0) {
        await DeletedContentSnapshot.findOneAndUpdate(
          { sourceContentId: id },
          {
            $setOnInsert: {
              sourceContentId: id,
              snapshot: content,
              deletedAt: new Date(),
              deletedBy: deletedBy ?? null,
              journalRefCount,
            },
          },
          { upsert: true, ...sessionOpts },
        )
        snapshotCreated = true
      } else if (!preserveForUsers) {
        await DeletedContentSnapshot.deleteMany({ sourceContentId: id }, sessionOpts)
        const removed = await journalsCollection.deleteMany({ templateId: id }, sessionOpts)
        journalsRemoved = removed?.deletedCount ?? 0
      }

      await Content.deleteOne({ _id: id }, sessionOpts)

      if (session) {
        await session.commitTransaction()
      }

      return {
        deleted: true,
        contentId: id,
        snapshotCreated,
        journalRefCount,
        journalsRemoved,
        preserveForUsers,
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction()
      }
      throw err
    } finally {
      if (session) {
        session.endSession()
      }
    }
  }

  async getStats(): Promise<{
    total: number
    published: number
    draft: number
    byType: Record<string, number>
  }> {
    const all = await Content.find().lean()
    const stats = {
      total: all.length,
      published: all.filter(c => c.isPublished).length,
      draft: all.filter(c => !c.isPublished).length,
      byType: {} as Record<string, number>,
    }
    
    all.forEach(c => {
      const type = c.itemType || 'unknown'
      stats.byType[type] = (stats.byType[type] || 0) + 1
    })
    
    return stats
  }
}

export const contentService = new ContentService()
