import { AdminUser } from '../domain/models/AdminUser'
import { AppUser } from '../domain/models/AppUser'
import { Content } from '../domain/models/Content'
import { settingsService } from './settingsService'
import type { PipelineStage } from 'mongoose'

export interface DashboardTrendPoint {
  date: string
  count: number
}

export interface DashboardAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
}

export interface DashboardOverview {
  generatedAt: string
  windowDays: number
  kpis: {
    totalUsers: number
    appUsers: number
    adminUsers: number
    activeUsersInWindow: number
    totalContent: number
    publishedContent: number
    draftContent: number
    publishRate: number
    bannedAppUsers: number
  }
  trends: {
    userSignups: DashboardTrendPoint[]
    contentCreated: DashboardTrendPoint[]
    contentPublished: DashboardTrendPoint[]
  }
  contentByType: Array<{ type: string; count: number; share: number }>
  recent: {
    users: Array<{
      id: string
      name: string
      email: string
      isBanned: boolean
      createdAt: string
      lastActiveAt?: string
    }>
    content: Array<{
      id: string
      name: string
      itemType: string
      category?: string
      isPublished: boolean
      updatedAt: string
    }>
  }
  alerts: DashboardAlert[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function toDayKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function buildSeries(days: number, bucketMap: Map<string, number>): DashboardTrendPoint[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const points: DashboardTrendPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS)
    const key = toDayKey(d)
    points.push({ date: key, count: bucketMap.get(key) ?? 0 })
  }

  return points
}

async function aggregateCountByDay(
  collection: typeof AppUser | typeof Content,
  dateField: 'createdAt' | 'updatedAt',
  fromDate: Date,
  extraMatch?: Record<string, unknown>
): Promise<Map<string, number>> {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        [dateField]: { $gte: fromDate },
        ...(extraMatch ?? {}),
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: `$${dateField}`,
          },
        },
        count: { $sum: 1 },
      },
    },
  ]

  const rows = await collection.aggregate<{ _id: string; count: number }>(pipeline)
  const out = new Map<string, number>()
  rows.forEach((row) => {
    out.set(row._id, row.count)
  })
  return out
}

function toIso(value?: Date): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString()
}

export const dashboardService = {
  async getOverview(days: number): Promise<DashboardOverview> {
    const windowDays = Math.max(7, Math.min(90, days))
    const fromDate = new Date(Date.now() - (windowDays - 1) * DAY_MS)

    const [
      appUsers,
      adminUsers,
      activeUsersInWindow,
      bannedAppUsers,
      totalContent,
      publishedContent,
      draftContent,
      recentUsers,
      recentContent,
      settings,
      signupsByDay,
      contentCreatedByDay,
      contentPublishedByDay,
      byTypeRows,
    ] = await Promise.all([
      AppUser.countDocuments(),
      AdminUser.countDocuments(),
      AppUser.countDocuments({ lastActiveAt: { $gte: fromDate } }),
      AppUser.countDocuments({ isBanned: true }),
      Content.countDocuments(),
      Content.countDocuments({ isPublished: true }),
      Content.countDocuments({ isPublished: false }),
      AppUser.find()
        .select('name email isBanned createdAt lastActiveAt')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      Content.find()
        .select('name itemType category isPublished updatedAt')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      settingsService.get(),
      aggregateCountByDay(AppUser, 'createdAt', fromDate),
      aggregateCountByDay(Content, 'createdAt', fromDate),
      aggregateCountByDay(Content, 'updatedAt', fromDate, { isPublished: true }),
      Content.aggregate<{ _id: string; count: number }>([
        {
          $group: {
            _id: '$itemType',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ])

    const publishRate = totalContent > 0 ? Number(((publishedContent / totalContent) * 100).toFixed(1)) : 0
    const totalUsers = appUsers + adminUsers

    const contentByType = byTypeRows.map((row) => ({
      type: row._id || 'unknown',
      count: row.count,
      share: totalContent > 0 ? Number(((row.count / totalContent) * 100).toFixed(1)) : 0,
    }))

    const alerts: DashboardAlert[] = []

    if (settings.maintenanceMode) {
      alerts.push({
        id: 'maintenance-mode',
        severity: 'critical',
        title: 'Maintenance Mode Enabled',
        message: 'The app is currently in maintenance mode for end users.',
      })
    }

    if (!settings.requireStrongPassword) {
      alerts.push({
        id: 'weak-password-policy',
        severity: 'warning',
        title: 'Strong Password Policy Disabled',
        message: 'Enable strong password enforcement to improve account security.',
      })
    }

    if (!settings.enableEmailNotifications) {
      alerts.push({
        id: 'notifications-off',
        severity: 'info',
        title: 'Email Notifications Disabled',
        message: 'Critical admin events will not trigger email notifications.',
      })
    }

    if (!settings.allowNewRegistrations) {
      alerts.push({
        id: 'registrations-closed',
        severity: 'warning',
        title: 'New Registrations Closed',
        message: 'New app user signups are currently blocked.',
      })
    }

    if (publishRate < 50 && totalContent >= 10) {
      alerts.push({
        id: 'low-publish-rate',
        severity: 'info',
        title: 'Low Publish Ratio',
        message: 'Less than half of content inventory is currently published.',
      })
    }

    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      kpis: {
        totalUsers,
        appUsers,
        adminUsers,
        activeUsersInWindow,
        totalContent,
        publishedContent,
        draftContent,
        publishRate,
        bannedAppUsers,
      },
      trends: {
        userSignups: buildSeries(windowDays, signupsByDay),
        contentCreated: buildSeries(windowDays, contentCreatedByDay),
        contentPublished: buildSeries(windowDays, contentPublishedByDay),
      },
      contentByType,
      recent: {
        users: recentUsers.map((u) => ({
          id: String(u._id),
          name: u.name,
          email: u.email,
          isBanned: Boolean(u.isBanned),
          createdAt: toIso(u.createdAt),
          ...(u.lastActiveAt ? { lastActiveAt: toIso(u.lastActiveAt) } : {}),
        })),
        content: recentContent.map((c) => ({
          id: String(c._id),
          name: c.name,
          itemType: c.itemType,
          category: c.category,
          isPublished: Boolean(c.isPublished),
          updatedAt: toIso(c.updatedAt),
        })),
      },
      alerts,
    }
  },
}
