import { Schema, model, Document } from 'mongoose'

export interface IAdminVerificationCode extends Document {
  email: string
  code: string
  type: 'forgot_password'
  verifyAttempts: number
  resendCount: number
  lastResendAt: Date
  expiresAt: Date
  isUsed: boolean
  createdAt: Date
  updatedAt: Date
}

const adminVerificationCodeSchema = new Schema<IAdminVerificationCode>(
  {
    email:          { type: String, required: true, lowercase: true, trim: true },
    code:           { type: String, required: true },
    type:           { type: String, enum: ['forgot_password'], required: true },
    verifyAttempts: { type: Number, default: 0 },
    resendCount:    { type: Number, default: 0 },
    lastResendAt:   { type: Date, default: Date.now },
    expiresAt:      { type: Date, required: true },
    isUsed:         { type: Boolean, default: false },
  },
  { timestamps: true }
)

adminVerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 })
adminVerificationCodeSchema.index({ email: 1, type: 1 })

export const AdminVerificationCode = model<IAdminVerificationCode>('AdminVerificationCode', adminVerificationCodeSchema)
