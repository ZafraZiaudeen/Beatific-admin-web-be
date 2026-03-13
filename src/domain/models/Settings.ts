import { Schema, model, Document } from 'mongoose'

export interface ISettings extends Document {
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
  verificationCodeExpiry: number
  maxCodeVerifyAttempts: number
  maxCodeResendAttempts: number
  codeResendCooldown: number
  codeSessionResetTime: number
  maxForgotPasswordAttempts: number
  forgotPasswordWindowMinutes: number
  updatedAt: Date
}

const settingsSchema = new Schema<ISettings>(
  {
    appName:                   { type: String, default: 'Beatific Admin' },
    appDescription:            { type: String, default: 'Content management panel for the Beatific app.' },
    supportEmail:              { type: String, default: '' },
    contactUrl:                { type: String, default: '' },
    maintenanceMode:           { type: Boolean, default: false },
    maintenanceMessage:        { type: String, default: 'We are currently down for maintenance. Please check back shortly.' },
    allowNewRegistrations:     { type: Boolean, default: true },
    sessionTimeoutHours:       { type: Number, default: 168 }, // 7 days
    sessionGeneration:         { type: Number, default: 0 },
    maxLoginAttempts:          { type: Number, default: 10 },
    requireStrongPassword:     { type: Boolean, default: false },
    enableEmailNotifications:  { type: Boolean, default: false },
    notifyOnNewUser:           { type: Boolean, default: true },
    notifyOnContentPublish:    { type: Boolean, default: false },
    notifyOnLogin:             { type: Boolean, default: false },
    verificationCodeExpiry:        { type: Number, default: 10 },
    maxCodeVerifyAttempts:          { type: Number, default: 5 },
    maxCodeResendAttempts:          { type: Number, default: 3 },
    codeResendCooldown:            { type: Number, default: 60 },
    codeSessionResetTime:          { type: Number, default: 30 },
    maxForgotPasswordAttempts:     { type: Number, default: 3 },
    forgotPasswordWindowMinutes:   { type: Number, default: 30 },
  },
  { timestamps: true }
)

export const Settings = model<ISettings>('Settings', settingsSchema)
