import { Router } from 'express'
import type { Request, Response } from 'express'
import { settingsService } from '../../application/settingsService'
import { requireAuth, requireAdminOrAbove } from '../middleware/authMiddleware'
import { AppUser } from '../../domain/models/AppUser'
import { emailService } from '../../infrastructure/email/emailService'

// Role values stored in JWTs — kept here for reference
// 'super_admin' | 'admin' | 'editor'

const settingsRouter = Router()

/** GET /settings — any authenticated admin can read */
settingsRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await settingsService.get()
    res.json({ success: true, data: settings })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to load settings' })
  }
})

/** PUT /settings/general — any authenticated admin */
settingsRouter.put('/general', requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const { appName, appDescription, supportEmail, contactUrl, maintenanceMode, maintenanceMessage, allowNewRegistrations } = req.body
    const updated = await settingsService.update({
      appName,
      appDescription,
      supportEmail,
      contactUrl,
      maintenanceMode,
      maintenanceMessage,
      allowNewRegistrations,
    })
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to update settings' })
  }
})

/** PUT /settings/security — any authenticated admin */
settingsRouter.put('/security', requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const { sessionTimeoutHours, maxLoginAttempts, requireStrongPassword } = req.body
    const sTH = sessionTimeoutHours === undefined ? undefined : Number(sessionTimeoutHours)
    const mLA = maxLoginAttempts === undefined ? undefined : Number(maxLoginAttempts)
    const rSP = requireStrongPassword === undefined ? undefined : Boolean(requireStrongPassword)

    if (sTH !== undefined && (!Number.isFinite(sTH) || sTH < 1 || sTH > 8760)) {
      res.status(400).json({ success: false, message: 'Session timeout must be between 1 and 8760 hours' })
      return
    }
    if (mLA !== undefined && (!Number.isFinite(mLA) || mLA < 3 || mLA > 100)) {
      res.status(400).json({ success: false, message: 'Max login attempts must be between 3 and 100' })
      return
    }

    // If any security setting changes, invalidate existing sessions.
    const current = await settingsService.get()
    const willChange =
      (sTH !== undefined && sTH !== current.sessionTimeoutHours) ||
      (mLA !== undefined && mLA !== current.maxLoginAttempts) ||
      (rSP !== undefined && rSP !== current.requireStrongPassword)

    const updated = await settingsService.update({
      sessionTimeoutHours: sTH,
      maxLoginAttempts: mLA,
      requireStrongPassword: rSP,
      ...(willChange ? { sessionGeneration: (current.sessionGeneration ?? 0) + 1 } : {}),
    })
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to update security settings' })
  }
})

/** PUT /settings/verification — admin controls for verification code rate limits */
settingsRouter.put('/verification', requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const {
      verificationCodeExpiry,
      maxCodeVerifyAttempts,
      maxCodeResendAttempts,
      codeResendCooldown,
      codeSessionResetTime,
      maxForgotPasswordAttempts,
      forgotPasswordWindowMinutes,
    } = req.body

    const payload: Record<string, number> = {}
    if (verificationCodeExpiry !== undefined) {
      const v = Number(verificationCodeExpiry)
      if (!Number.isFinite(v) || v < 1 || v > 60) {
        res.status(400).json({ success: false, message: 'Code expiry must be between 1 and 60 minutes' })
        return
      }
      payload.verificationCodeExpiry = v
    }
    if (maxCodeVerifyAttempts !== undefined) {
      const v = Number(maxCodeVerifyAttempts)
      if (!Number.isFinite(v) || v < 1 || v > 20) {
        res.status(400).json({ success: false, message: 'Max verify attempts must be between 1 and 20' })
        return
      }
      payload.maxCodeVerifyAttempts = v
    }
    if (maxCodeResendAttempts !== undefined) {
      const v = Number(maxCodeResendAttempts)
      if (!Number.isFinite(v) || v < 1 || v > 20) {
        res.status(400).json({ success: false, message: 'Max resend attempts must be between 1 and 20' })
        return
      }
      payload.maxCodeResendAttempts = v
    }
    if (codeResendCooldown !== undefined) {
      const v = Number(codeResendCooldown)
      if (!Number.isFinite(v) || v < 10 || v > 600) {
        res.status(400).json({ success: false, message: 'Resend cooldown must be between 10 and 600 seconds' })
        return
      }
      payload.codeResendCooldown = v
    }
    if (codeSessionResetTime !== undefined) {
      const v = Number(codeSessionResetTime)
      if (!Number.isFinite(v) || v < 5 || v > 1440) {
        res.status(400).json({ success: false, message: 'Session reset time must be between 5 and 1440 minutes' })
        return
      }
      payload.codeSessionResetTime = v
    }
    if (maxForgotPasswordAttempts !== undefined) {
      const v = Number(maxForgotPasswordAttempts)
      if (!Number.isFinite(v) || v < 1 || v > 20) {
        res.status(400).json({ success: false, message: 'Max forgot password attempts must be between 1 and 20' })
        return
      }
      payload.maxForgotPasswordAttempts = v
    }
    if (forgotPasswordWindowMinutes !== undefined) {
      const v = Number(forgotPasswordWindowMinutes)
      if (!Number.isFinite(v) || v < 5 || v > 1440) {
        res.status(400).json({ success: false, message: 'Forgot password window must be between 5 and 1440 minutes' })
        return
      }
      payload.forgotPasswordWindowMinutes = v
    }

    const updated = await settingsService.update(payload)
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to update verification settings' })
  }
})

/** PUT /settings/notifications — any authenticated admin */
settingsRouter.put('/notifications', requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const { enableEmailNotifications, notifyOnNewUser, notifyOnContentPublish, notifyOnLogin } = req.body
    const updated = await settingsService.update({ enableEmailNotifications, notifyOnNewUser, notifyOnContentPublish, notifyOnLogin })
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to update notification settings' })
  }
})

// ── Danger Zone ──────────────────────────────────────────────────────────────

/**
 * POST /settings/flush-sessions
 * Logs a flush event. In production you would rotate the JWT secret or
 * maintain a denylist. For now we acknowledge the action and tell all
 * active sessions to log in again by bumping a server-side generation key.
 */
settingsRouter.post('/flush-sessions', requireAdminOrAbove, async (_req: Request, res: Response) => {
  try {
    const current = await settingsService.get()
    await settingsService.update({ sessionGeneration: (current.sessionGeneration ?? 0) + 1 })
    console.log(`[DANGER] Admin flushed all sessions at ${new Date().toISOString()}`)
    res.json({ success: true, message: 'All admin sessions have been invalidated. Users will need to log in again.' })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to flush sessions' })
  }
})

/**
 * POST /settings/test-notification
 * Sends a test email simulating a specific notification trigger.
 * Body: { type: 'new-user' | 'content-published' | 'admin-login' }
 */
settingsRouter.post('/test-notification', requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const { type } = req.body as { type: string }
    const settings = await settingsService.get()
    const to = (settings.supportEmail ?? '').trim() || undefined

    const templates: Record<string, { subject: string; text: string }> = {
      'new-user': {
        subject: '[Beatific Admin] Test — New User Registered',
        text: `This is a test notification for "New User Registered".\n\nName: Test User\nEmail: test@example.com\nRole: editor\nTime: ${new Date().toISOString()}`,
      },
      'content-published': {
        subject: '[Beatific Admin] Test — Content Published',
        text: `This is a test notification for "Content Published".\n\nName: Sample Content\nType: template\nCategory: N/A\nTime: ${new Date().toISOString()}`,
      },
      'admin-login': {
        subject: '[Beatific Admin] Test — Admin Login',
        text: `This is a test notification for "Admin Login".\n\nName: Test Admin\nEmail: admin@example.com\nRole: admin\nTime: ${new Date().toISOString()}`,
      },
    }

    const template = templates[type]
    if (!template) {
      res.status(400).json({ success: false, message: `Unknown notification type: ${type}` })
      return
    }

    await emailService.send({ to, ...template })
    const dest = to ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'configured address'
    res.json({ success: true, message: `Test notification sent to ${dest}.` })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? 'Failed to send test notification' })
  }
})

/** POST /settings/test-email — sends a test email to the configured Support Email */
settingsRouter.post('/test-email', requireAdminOrAbove, async (_req: Request, res: Response) => {
  try {
    const settings = await settingsService.get()
    const to = (settings.supportEmail ?? '').trim()
    if (!to) {
      res.status(400).json({ success: false, message: 'Support Email is not set. Set it in Settings → General first.' })
      return
    }
    await emailService.send({
      to,
      subject: '[Beatific Admin] Test email',
      text: `This is a test email from Beatific Admin.\n\nTime: ${new Date().toISOString()}`,
    })
    res.json({ success: true, message: `Test email sent to ${to}.` })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? 'Failed to send test email' })
  }
})

/**
 * POST /settings/ban-all-users
 * Bans every app user. Can be reversed from the Users page.
 */
settingsRouter.post('/ban-all-users', requireAdminOrAbove, async (_req: Request, res: Response) => {
  try {
    const result = await AppUser.updateMany({}, { isBanned: true })
    console.log(`[DANGER] Admin banned all app users — ${result.modifiedCount} affected at ${new Date().toISOString()}`)
    res.json({ success: true, message: `${result.modifiedCount} app user(s) have been banned. Reverse this from the Users page.` })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to ban users' })
  }
})

/**
 * POST /settings/reset
 * Restores all platform settings to their schema defaults.
 */
settingsRouter.post('/reset', requireAdminOrAbove, async (_req: Request, res: Response) => {
  try {
    const updated = await settingsService.update({
      appName: 'Beatific Admin',
      appDescription: 'Content management panel for the Beatific app.',
      supportEmail: '',
      contactUrl: '',
      maintenanceMode: false,
      maintenanceMessage: 'We are currently down for maintenance. Please check back shortly.',
      allowNewRegistrations: true,
      sessionTimeoutHours: 168,
      maxLoginAttempts: 10,
      requireStrongPassword: false,
      enableEmailNotifications: false,
      notifyOnNewUser: true,
      notifyOnContentPublish: false,
      notifyOnLogin: false,
      verificationCodeExpiry: 10,
      maxCodeVerifyAttempts: 5,
      maxCodeResendAttempts: 3,
      codeResendCooldown: 60,
      codeSessionResetTime: 30,
      maxForgotPasswordAttempts: 3,
      forgotPasswordWindowMinutes: 30,
    })
    console.log(`[DANGER] Admin reset settings to defaults at ${new Date().toISOString()}`)
    res.json({ success: true, message: 'All settings have been reset to factory defaults.', data: updated })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to reset settings' })
  }
})

export default settingsRouter

