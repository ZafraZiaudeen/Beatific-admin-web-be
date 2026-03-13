import { Settings } from '../domain/models/Settings'

export type SettingsUpdate = Partial<{
  appName: string
  appDescription: string
  supportEmail: string
  contactUrl: string
  maintenanceMode: boolean
  maintenanceMessage: string
  allowNewRegistrations: boolean
  sessionTimeoutHours: number
  sessionGeneration: number
  maxLoginAttempts: number
  requireStrongPassword: boolean
  enableEmailNotifications: boolean
  notifyOnNewUser: boolean
  notifyOnContentPublish: boolean
  notifyOnLogin: boolean
  // Verification & rate-limit settings
  verificationCodeExpiry: number
  maxCodeVerifyAttempts: number
  maxCodeResendAttempts: number
  codeResendCooldown: number
  codeSessionResetTime: number
  maxForgotPasswordAttempts: number
  forgotPasswordWindowMinutes: number
}>

export const settingsService = {
  async get() {
    let settings = await Settings.findOne()
    if (!settings) {
      settings = await Settings.create({})
    }
    return settings
  },

  async update(data: SettingsUpdate) {
    let settings = await Settings.findOne()
    if (!settings) {
      settings = await Settings.create(data)
    } else {
      Object.assign(settings, data)
      await settings.save()
    }
    return settings
  },
}
