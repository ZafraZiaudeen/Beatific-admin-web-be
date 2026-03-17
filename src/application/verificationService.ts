import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { AdminVerificationCode } from '../domain/models/AdminVerificationCode'
import { AdminUser } from '../domain/models/AdminUser'
import { settingsService } from './settingsService'
import { emailService } from '../infrastructure/email/emailService'

const JWT_SECRET = process.env.JWT_SECRET ?? 'beatific-admin-secret-key-change-in-production'

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

function throwErr(message: string, statusCode: number): never {
  const err: any = new Error(message)
  err.statusCode = statusCode
  throw err
}

export const verificationService = {

  async sendForgotPasswordCode(email: string) {
    const settings = await settingsService.get()

    const user = await AdminUser.findOne({ email })
    if (!user) {
      return {
        message: 'If an account with that email exists, a reset code has been sent.',
        expiresIn: settings.verificationCodeExpiry * 60,
        resendCooldown: settings.codeResendCooldown,
        resendsRemaining: settings.maxCodeResendAttempts,
      }
    }

    const windowStart = new Date(Date.now() - settings.forgotPasswordWindowMinutes * 60 * 1000)
    const recentCount = await AdminVerificationCode.countDocuments({
      email,
      type: 'forgot_password',
      createdAt: { $gte: windowStart },
    })

    if (recentCount >= settings.maxForgotPasswordAttempts) {
      throwErr(`Too many password reset requests. Please try again in ${settings.forgotPasswordWindowMinutes} minutes.`, 429)
    }

    const existingCode = await AdminVerificationCode.findOne({
      email,
      type: 'forgot_password',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    })

    if (existingCode) {
      if (existingCode.resendCount >= settings.maxCodeResendAttempts) {
        const resetAt = new Date(existingCode.updatedAt.getTime() + settings.codeSessionResetTime * 60 * 1000)
        if (new Date() < resetAt) {
          const minutesLeft = Math.ceil((resetAt.getTime() - Date.now()) / 60000)
          throwErr(`Maximum resend attempts reached. Please try again in ${minutesLeft} minute(s).`, 429)
        }
        await AdminVerificationCode.deleteOne({ _id: existingCode._id })
      } else {
        const cooldownExpiry = new Date(existingCode.lastResendAt.getTime() + settings.codeResendCooldown * 1000)
        if (new Date() < cooldownExpiry) {
          const secsLeft = Math.ceil((cooldownExpiry.getTime() - Date.now()) / 1000)
          throwErr(`Please wait ${secsLeft} seconds before requesting a new code.`, 429)
        }

        const newCode = generateCode()
        existingCode.code = newCode
        existingCode.resendCount += 1
        existingCode.lastResendAt = new Date()
        existingCode.verifyAttempts = 0
        existingCode.expiresAt = new Date(Date.now() + settings.verificationCodeExpiry * 60 * 1000)
        await existingCode.save()

        await emailService.sendVerificationCode(email, newCode, 'forgot_password')
        return {
          message: 'A new reset code has been sent to your email.',
          expiresIn: settings.verificationCodeExpiry * 60,
          resendCooldown: settings.codeResendCooldown,
          resendsRemaining: settings.maxCodeResendAttempts - existingCode.resendCount,
        }
      }
    }

    const code = generateCode()
    await AdminVerificationCode.deleteMany({ email, type: 'forgot_password', isUsed: false })

    await AdminVerificationCode.create({
      email,
      code,
      type: 'forgot_password',
      expiresAt: new Date(Date.now() + settings.verificationCodeExpiry * 60 * 1000),
    })

    await emailService.sendVerificationCode(email, code, 'forgot_password')

    return {
      message: 'If an account with that email exists, a reset code has been sent.',
      expiresIn: settings.verificationCodeExpiry * 60,
      resendCooldown: settings.codeResendCooldown,
      resendsRemaining: settings.maxCodeResendAttempts,
    }
  },

  async verifyForgotPasswordCode(email: string, code: string) {
    const settings = await settingsService.get()

    const record = await AdminVerificationCode.findOne({
      email,
      type: 'forgot_password',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    })

    if (!record) {
      throwErr('Verification code has expired or was not found. Please request a new code.', 400)
    }

    if (record.verifyAttempts >= settings.maxCodeVerifyAttempts) {
      await AdminVerificationCode.deleteOne({ _id: record._id })
      throwErr('Too many incorrect attempts. Please request a new code.', 429)
    }

    if (record.code !== code) {
      record.verifyAttempts += 1
      await record.save()
      const remaining = settings.maxCodeVerifyAttempts - record.verifyAttempts
      throwErr(`Invalid code. ${remaining} attempt(s) remaining.`, 400)
    }

    const resetToken = jwt.sign(
      { email, purpose: 'admin_password_reset', codeId: record._id.toString() },
      JWT_SECRET,
      { expiresIn: '15m' } as jwt.SignOptions
    )

    return {
      message: 'Code verified successfully.',
      resetToken,
    }
  },

  async resetPassword(resetToken: string, newPassword: string) {
    let payload: any
    try {
      payload = jwt.verify(resetToken, JWT_SECRET)
    } catch {
      throwErr('Reset token is invalid or has expired. Please start over.', 400)
    }

    if (payload.purpose !== 'admin_password_reset') {
      throwErr('Invalid reset token.', 400)
    }

    const record = await AdminVerificationCode.findById(payload.codeId)
    if (!record || record.isUsed) {
      throwErr('This reset link has already been used. Please request a new one.', 400)
    }

    const user = await AdminUser.findOne({ email: payload.email })
    if (!user) {
      throwErr('User not found.', 404)
    }

    if (newPassword.length < 6) {
      throwErr('Password must be at least 6 characters.', 400)
    }

    const bcrypt = await import('bcryptjs')
    const hashed = await bcrypt.hash(newPassword, 10)
    await AdminUser.findByIdAndUpdate(user._id, { password: hashed })

    record.isUsed = true
    await record.save()

    return { message: 'Password has been reset successfully. You can now sign in.' }
  },

  async resendCode(email: string) {
    return this.sendForgotPasswordCode(email)
  },
}
