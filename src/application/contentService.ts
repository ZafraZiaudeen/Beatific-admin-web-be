import mongoose from 'mongoose'
import { Content } from '../domain/models/Content'
import { DeletedContentSnapshot } from '../domain/models/DeletedContentSnapshot'
import { IContent } from '../domain/interfaces/IContent'
import { emailService } from '../infrastructure/email/emailService'
import { settingsService } from './settingsService'
import { getAppConnection } from '../infrastructure/database/appConnection'
import {
  deleteSchedulesForContentEverywhere,
  refreshSchedulesForContentInAppDb,
} from './calendarScheduleService'
import { deleteCloudinaryAssetsForDeletedSource } from '../infrastructure/storage/contentAssetCleanup'

export interface CreateContentDto {
  name: string
  description?: string
  itemType: string  
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

export interface DeleteContentOptions {
  keepForExistingJournals?: boolean
  deletedBy?: string
}

export class ContentService {

  private syncContentToAppDbAsync(content: IContent | null): void {
    if (!content?._id) return
    this._doSyncContentToAppDb(content).catch((err: any) => {
      console.warn('[app-db] Background sync failed:', err?.message ?? err)
    })
  }

  private async _doSyncContentToAppDb(content: IContent): Promise<void> {
    const appConn = await getAppConnection()
    if (!appConn) return

    const AppContent =
      appConn.models.Content ?? appConn.model<IContent>('Content', Content.schema)

    const payload: Partial<IContent> & { updatedAt?: Date } = {
      name: content.name,
      description: content.description,
      itemType: content.itemType,
      category: content.category,
      subcategory: content.subcategory,
      tags: content.tags ?? [],
      pages: content.pages ?? [],
      svgContent: content.svgContent,
      coverImageUrl: content.coverImageUrl,
      createdBy: content.createdBy,
      isPublished: content.isPublished,
    }

    if (content.updatedAt) payload.updatedAt = content.updatedAt

    const update: Record<string, unknown> = { $set: payload }
    if (content.createdAt) {
      update.$setOnInsert = { createdAt: content.createdAt }
    }

    await AppContent.findByIdAndUpdate(
      content._id,
      update,
      { upsert: true, setDefaultsOnInsert: true }
    )

    await refreshSchedulesForContentInAppDb(String(content._id))
  }

  private deleteContentFromAppDbAsync(id: string): void {
    this._doDeleteContentFromAppDb(id).catch((err: any) => {
      console.warn('[app-db] Background delete failed:', err?.message ?? err)
    })
  }

  private async _doDeleteContentFromAppDb(id: string): Promise<void> {
    const appConn = await getAppConnection()
    if (!appConn) return
    const AppContent =
      appConn.models.Content ?? appConn.model<IContent>('Content', Content.schema)
    await AppContent.findByIdAndDelete(id)
  }

  private async snapshotContentForJournals(content: IContent, deletedBy?: string): Promise<void> {
    if (!content?._id) return
    const appConn = await getAppConnection()
    if (!appConn) return

    try {
      const journalRefCount = await appConn.collection('journals').countDocuments({ templateId: String(content._id) })

      await appConn.collection('deletedcontentsnapshots').updateOne(
        { sourceContentId: String(content._id) },
        {
          $set: {
            sourceContentId: String(content._id),
            snapshot: {
              ...((content as any).toObject ? (content as any).toObject() : content),
              _id: String(content._id),
            },
            deletedAt: new Date(),
            deletedBy,
            journalRefCount,
          },
        },
        { upsert: true }
      )
    } catch (err: any) {
      console.warn('[app-db] Failed to create deleted content snapshot:', err?.message ?? err)
    }
  }

  private async purgeContentReferences(contentId: string): Promise<void> {
    const appConn = await getAppConnection()
    if (!appConn) return
    try {
      await Promise.all([
        appConn.collection('deletedcontentsnapshots').deleteMany({ sourceContentId: contentId }),
        appConn.collection('journals').deleteMany({ templateId: contentId }),
      ])
    } catch (err: any) {
      console.warn('[app-db] Failed to purge content references:', err?.message ?? err)
    }
  }

  async create(dto: CreateContentDto): Promise<IContent> {
    const content = new Content(dto)
    const saved = await content.save()
    this.syncContentToAppDbAsync(saved)
    return saved
  }

  async list(params: {
    itemType?: string
    category?: string
    subcategory?: string
    search?: string
    isPublished?: boolean
  }): Promise<{ data: IContent[]; total: number }> {
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
    const updated = await Content.findByIdAndUpdate(
      id,
      { $set: dto },
      { returnDocument: 'after', runValidators: true }
    )
    this.syncContentToAppDbAsync(updated)
    return updated
  }

  async savePages(id: string, pages: object[], svgContent?: string): Promise<IContent | null> {
    const update: Record<string, unknown> = { pages }
    if (svgContent !== undefined) update.svgContent = svgContent
    
    const updated = await Content.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: 'after', projection: { pages: 0 } }
    )
    this.syncContentToAppDbAsync(updated)
    return updated
  }

  async saveAll(
    id: string,
    dto: UpdateContentDto,
    pages: object[],
    svgContent?: string,
  ): Promise<IContent | null> {
    const setPayload: Record<string, unknown> = { ...dto, pages }
    if (svgContent !== undefined) setPayload.svgContent = svgContent

    const updated = await Content.findByIdAndUpdate(
      id,
      { $set: setPayload },
      { returnDocument: 'after', runValidators: true, projection: { pages: 0 } }
    )
    this.syncContentToAppDbAsync(updated)
    return updated
  }

  async publish(id: string, isPublished: boolean): Promise<IContent | null> {
    const content = await Content.findByIdAndUpdate(
      id,
      { $set: { isPublished } },
      { returnDocument: 'after' }
    )

    if (content && isPublished) {
      settingsService.get().then(settings => {
        if (settings.enableEmailNotifications && settings.notifyOnContentPublish) {
          emailService.send({
            to: settings.supportEmail || undefined,
            subject: `[Beatific Admin] Content Published: ${content.name}`,
            text: `New content was just published to the app.\n\nName: ${content.name}\nType: ${content.itemType}\nCategory: ${content.category || 'N/A'}\nTime: ${new Date().toISOString()}`,
          }).catch((err: any) => console.warn('[Email] Failed to send publish notification:', err.message))
        }
      }).catch(() => { /* settings fetch failed — non-critical */ })
    }

    this.syncContentToAppDbAsync(content)
    return content
  }

  async delete(id: string, options?: DeleteContentOptions): Promise<boolean> {
    const existing = await Content.findById(id)
    if (!existing) return false

    if (options?.keepForExistingJournals) {
      await this.snapshotContentForJournals(existing, options.deletedBy)
    } else {
      await Promise.all([
        this.purgeContentReferences(String(existing._id)),
        deleteSchedulesForContentEverywhere(String(existing._id)),
        deleteCloudinaryAssetsForDeletedSource(existing, {
          sourceKind: 'content',
          sourceId: String(existing._id),
        }),
      ])
    }

    const result = await Content.findByIdAndDelete(id)
    if (result) this.deleteContentFromAppDbAsync(id)
    return !!result
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
