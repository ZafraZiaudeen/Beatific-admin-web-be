import mongoose from 'mongoose'
import { CalendarSchedule } from '../domain/models/CalendarSchedule'
import type { ICalendarSchedule } from '../domain/interfaces/ICalendarSchedule'
import { Content } from '../domain/models/Content'
import { getAppConnection } from '../infrastructure/database/appConnection'

const DAY_MS = 24 * 60 * 60 * 1000
const ROLLING_HORIZON_DAYS = 90

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date.getTime())
  copy.setUTCMonth(copy.getUTCMonth() + months)
  return copy
}

function startOfTodayUtc(): Date {
  return toUtcDate(toDateStr(new Date()))
}

function normalizeWeekdays(weekdays?: string[]): string[] {
  return Array.from(new Set((weekdays ?? []).map((day) => String(day).trim().toLowerCase()).filter(Boolean)))
}

function getWeekdayName(date: Date): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getUTCDay()]
}

function listOccurrences(
  schedule: Pick<ICalendarSchedule, 'mode' | 'exactDate' | 'recurrence'>,
  options?: { from?: string; to?: string; max?: number }
): string[] {
  const from = options?.from ? toUtcDate(options.from) : startOfTodayUtc()
  const to = options?.to ? toUtcDate(options.to) : addDays(from, ROLLING_HORIZON_DAYS - 1)
  const max = options?.max ?? 120

  if (schedule.mode === 'exact') {
    if (!schedule.exactDate) return []
    const exact = toUtcDate(schedule.exactDate)
    if (exact < from || exact > to) return []
    return [schedule.exactDate]
  }

  if (!schedule.recurrence?.startDate) return []

  const recurrence = schedule.recurrence
  const start = toUtcDate(recurrence.startDate)
  const end = recurrence.endDate ? toUtcDate(recurrence.endDate) : to
  const windowStart = from > start ? from : start
  const windowEnd = end < to ? end : to
  if (windowEnd < windowStart) return []

  const interval = Math.max(1, recurrence.interval || 1)
  const results: string[] = []

  if (recurrence.frequency === 'daily') {
    for (let cursor = windowStart; cursor <= windowEnd && results.length < max; cursor = addDays(cursor, 1)) {
      const diffDays = Math.floor((cursor.getTime() - start.getTime()) / DAY_MS)
      if (diffDays >= 0 && diffDays % interval === 0) {
        results.push(toDateStr(cursor))
      }
    }
    return results
  }

  if (recurrence.frequency === 'weekly') {
    const weekdays = normalizeWeekdays(recurrence.weekdays)
    if (!weekdays.length) return []
    for (let cursor = windowStart; cursor <= windowEnd && results.length < max; cursor = addDays(cursor, 1)) {
      const diffDays = Math.floor((cursor.getTime() - start.getTime()) / DAY_MS)
      if (diffDays < 0) continue
      const diffWeeks = Math.floor(diffDays / 7)
      if (diffWeeks % interval !== 0) continue
      if (weekdays.includes(getWeekdayName(cursor))) {
        results.push(toDateStr(cursor))
      }
    }
    return results
  }

  const dayOfMonth = Math.max(1, Math.min(31, recurrence.dayOfMonth || start.getUTCDate()))
  const anchorYear = start.getUTCFullYear()
  const anchorMonth = start.getUTCMonth()
  let cursor = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1))

  while (cursor <= windowEnd && results.length < max) {
    const monthIndex = (cursor.getUTCFullYear() - anchorYear) * 12 + (cursor.getUTCMonth() - anchorMonth)
    if (monthIndex >= 0 && monthIndex % interval === 0) {
      const daysInMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate()
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(dayOfMonth, daysInMonth)))
      if (candidate >= windowStart && candidate >= start && candidate <= windowEnd) {
        results.push(toDateStr(candidate))
      }
    }
    cursor = addMonths(cursor, 1)
  }

  return results
}

function sanitizePayload(input: Partial<ICalendarSchedule>) {
  const payload: Partial<ICalendarSchedule> = {
    contentId: input.contentId ? String(input.contentId) : undefined,
    mode: input.mode,
    exactDate: input.exactDate || undefined,
    slotLabel: input.slotLabel ? String(input.slotLabel).trim() : undefined,
    startTime: input.startTime ? String(input.startTime).trim() : undefined,
    isActive: input.isActive ?? true,
    recurrence: input.recurrence
      ? {
          frequency: input.recurrence.frequency,
          interval: Math.max(1, Number(input.recurrence.interval || 1)),
          weekdays: normalizeWeekdays(input.recurrence.weekdays),
          dayOfMonth: input.recurrence.dayOfMonth ? Number(input.recurrence.dayOfMonth) : undefined,
          startDate: input.recurrence.startDate,
          endDate: input.recurrence.endDate || undefined,
        }
      : undefined,
  }

  if (payload.mode === 'exact') {
    payload.recurrence = undefined
  } else {
    payload.exactDate = undefined
  }

  return payload
}

async function assertValidScheduleInput(payload: Partial<ICalendarSchedule>) {
  if (!payload.contentId) {
    const err: any = new Error('contentId is required')
    err.statusCode = 400
    throw err
  }

  const content = await Content.findById(payload.contentId).lean()
  if (!content || !content.isPublished || ['sticker', 'page'].includes(String(content.itemType || '').toLowerCase())) {
    const err: any = new Error('Only published primary content can be scheduled')
    err.statusCode = 400
    throw err
  }

  if (payload.mode === 'exact') {
    if (!payload.exactDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.exactDate)) {
      const err: any = new Error('exactDate is required in YYYY-MM-DD format')
      err.statusCode = 400
      throw err
    }
    return content
  }

  const recurrence = payload.recurrence
  if (!recurrence) {
    const err: any = new Error('recurrence is required for recurring schedules')
    err.statusCode = 400
    throw err
  }
  if (!recurrence.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(recurrence.startDate)) {
    const err: any = new Error('recurrence.startDate must be in YYYY-MM-DD format')
    err.statusCode = 400
    throw err
  }
  if (recurrence.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(recurrence.endDate)) {
    const err: any = new Error('recurrence.endDate must be in YYYY-MM-DD format')
    err.statusCode = 400
    throw err
  }
  if (recurrence.frequency === 'weekly' && normalizeWeekdays(recurrence.weekdays).length === 0) {
    const err: any = new Error('recurrence.weekdays is required for weekly schedules')
    err.statusCode = 400
    throw err
  }
  if (recurrence.frequency === 'monthly' && !recurrence.dayOfMonth) {
    const err: any = new Error('recurrence.dayOfMonth is required for monthly schedules')
    err.statusCode = 400
    throw err
  }

  return content
}

async function materializeScheduleInAppDb(schedule: ICalendarSchedule): Promise<void> {
  const appConn = await getAppConnection()
  if (!appConn) return

  const contentId = new mongoose.Types.ObjectId(String(schedule.contentId))
  const content = await appConn.collection('contents').findOne({ _id: contentId })
  if (!content || !content.isPublished || ['sticker', 'page'].includes(String(content.itemType || '').toLowerCase())) return

  const users = await appConn.collection('appusers').find({}, { projection: { _id: 1 } }).toArray()
  const userIds = users.map((user) => String(user._id))
  const today = toDateStr(startOfTodayUtc())
  const activeDates = schedule.isActive
    ? new Set(listOccurrences(schedule, { from: today, to: toDateStr(addDays(startOfTodayUtc(), ROLLING_HORIZON_DAYS - 1)) }))
    : new Set<string>()
  const scheduleId = String(schedule._id)
  const journalsCollection = appConn.collection('journals')

  const existing = await journalsCollection.find({ scheduleId }).toArray()
  for (const journal of existing) {
    const journalDate = String((journal as any).calendarDate || '')
    const isFutureOrToday = journalDate && journalDate >= today
    if (!activeDates.has(journalDate) && !(journal as any).hasUserEdits && isFutureOrToday) {
      await journalsCollection.deleteOne({ _id: (journal as any)._id })
    }
  }

  if (!schedule.isActive) return

  const pages = Array.isArray((content as any).pages) ? (content as any).pages : []
  const seededPages = pages.map((page: any) => ({
    pageId: page.id,
    sourcePageId: page.id,
    name: page.name,
    background: page.background ?? '#ffffff',
    pageWidth: page.width ?? 595,
    pageHeight: page.height ?? 842,
    elements: Array.isArray(page.elements) ? page.elements : [],
    drawingPaths: [],
    updatedAt: new Date(),
  }))
  const pageOrder = seededPages.map((page: any) => page.pageId)

  for (const userId of userIds) {
    for (const calendarDate of activeDates) {
      const existingJournal = await journalsCollection.findOne({ userId, scheduleId, calendarDate })
      if (existingJournal) {
        if ((existingJournal as any).hasUserEdits) continue
        await journalsCollection.updateOne(
          { _id: (existingJournal as any)._id },
          {
            $set: {
              templateId: String((content as any)._id),
              sourceKind: 'scheduled',
              slotLabel: schedule.slotLabel,
              startTime: schedule.startTime,
              pageOrder,
              pages: seededPages,
              scheduleRevisionApplied: schedule.revision,
              updatedAt: new Date(),
            },
          }
        )
        continue
      }

      await journalsCollection.insertOne({
        userId,
        templateId: String((content as any)._id),
        copyNumber: 0,
        calendarDate,
        scheduleId,
        sourceKind: 'scheduled',
        slotLabel: schedule.slotLabel,
        startTime: schedule.startTime,
        hasUserEdits: false,
        scheduleRevisionApplied: schedule.revision,
        pageOrder,
        pages: seededPages,
        recentPageActivity: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  }
}

async function syncScheduleToAppDb(schedule: ICalendarSchedule | null): Promise<void> {
  if (!schedule?._id) return
  const appConn = await getAppConnection()
  if (!appConn) return

  const scheduleId = new mongoose.Types.ObjectId(String(schedule._id))
  await appConn.collection('calendarschedules').updateOne(
    { _id: scheduleId },
    {
      $set: {
        contentId: String(schedule.contentId),
        mode: schedule.mode,
        exactDate: schedule.exactDate,
        recurrence: schedule.recurrence,
        slotLabel: schedule.slotLabel,
        startTime: schedule.startTime,
        isActive: schedule.isActive,
        revision: schedule.revision,
        createdBy: schedule.createdBy,
        updatedAt: schedule.updatedAt ?? new Date(),
      },
      $setOnInsert: {
        createdAt: schedule.createdAt ?? new Date(),
      },
    },
    { upsert: true }
  )

  await materializeScheduleInAppDb(schedule)
}

async function deleteScheduleFromAppDb(scheduleId: string): Promise<void> {
  const appConn = await getAppConnection()
  if (!appConn) return
  await appConn.collection('calendarschedules').deleteOne({ _id: new mongoose.Types.ObjectId(scheduleId) })
}

export async function refreshSchedulesForContentInAppDb(contentId: string): Promise<void> {
  const schedules = await CalendarSchedule.find({ contentId, isActive: true }).lean()
  for (const schedule of schedules) {
    await materializeScheduleInAppDb(schedule as ICalendarSchedule)
  }
}

export const calendarScheduleService = {
  async list() {
    const schedules = await CalendarSchedule.find().sort({ updatedAt: -1 }).lean()
    const contentIds = schedules.map((schedule) => String(schedule.contentId))
    const contents = await Content.find({ _id: { $in: contentIds } }, { name: 1, itemType: 1, coverImageUrl: 1 }).lean()
    const contentMap = new Map(contents.map((content: any) => [String(content._id), content]))

    return schedules.map((schedule: any) => ({
      ...schedule,
      content: contentMap.get(String(schedule.contentId)) ?? null,
      upcomingDates: listOccurrences(schedule, { max: 6 }),
    }))
  },

  async preview(body: Partial<ICalendarSchedule>) {
    const payload = sanitizePayload(body)
    await assertValidScheduleInput(payload)
    return listOccurrences(payload as Pick<ICalendarSchedule, 'mode' | 'exactDate' | 'recurrence'>, { max: 12 })
  },

  async create(body: Partial<ICalendarSchedule>, adminId?: string) {
    const payload = sanitizePayload(body)
    await assertValidScheduleInput(payload)

    const created = await CalendarSchedule.create({
      ...payload,
      createdBy: adminId,
      revision: 1,
    })

    await syncScheduleToAppDb(created.toObject() as ICalendarSchedule)
    return created
  },

  async update(id: string, body: Partial<ICalendarSchedule>) {
    const existing = await CalendarSchedule.findById(id)
    if (!existing) return null

    const payload = sanitizePayload(body)
    await assertValidScheduleInput({ ...existing.toObject(), ...payload })

    existing.set(payload)
    existing.revision = (existing.revision ?? 0) + 1
    await existing.save()

    await syncScheduleToAppDb(existing.toObject() as ICalendarSchedule)
    return existing
  },

  async delete(id: string) {
    const existing = await CalendarSchedule.findById(id)
    if (!existing) return false

    const appConn = await getAppConnection()
    if (appConn) {
      await appConn.collection('journals').deleteMany({
        scheduleId: id,
        calendarDate: { $gte: toDateStr(startOfTodayUtc()) },
        hasUserEdits: false,
      })
    }

    await CalendarSchedule.deleteOne({ _id: id })
    await deleteScheduleFromAppDb(id)
    return true
  },
}
