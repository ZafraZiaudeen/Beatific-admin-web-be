import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AdminUser } from '../domain/models/AdminUser'
import { settingsService } from './settingsService'
import { emailService } from '../infrastructure/email/emailService'
import type { LoginCredentials, RegisterCredentials, AuthResponse } from '../domain/interfaces/IAuth'

const JWT_SECRET = process.env.JWT_SECRET ?? 'beatific-admin-secret-key-change-in-production'

export const authService = {
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { name, email, password } = credentials

    const settings = await settingsService.get()
    if (!settings.allowNewRegistrations) {
      const err: any = new Error('New registrations are currently disabled by the administrator')
      err.statusCode = 403
      throw err
    }

    if (settings.requireStrongPassword) {
      const hasUpper  = /[A-Z]/.test(password)
      const hasNumber = /\d/.test(password)
      const hasSymbol = /[^a-zA-Z0-9]/.test(password)
      if (!hasUpper || !hasNumber || !hasSymbol || password.length < 6) {
        const err: any = new Error('Password must include uppercase letters, numbers, and special characters')
        err.statusCode = 400
        throw err
      }
    }

    const existing = await AdminUser.findOne({ email })
    if (existing) {
      const err: any = new Error('An account with this email already exists')
      err.statusCode = 409
      throw err
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await AdminUser.create({
      name,
      email,
      password: hashedPassword,
    })

    const expiresIn = `${settings.sessionTimeoutHours ?? 168}h`
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role, sg: settings.sessionGeneration ?? 0 },
      JWT_SECRET,
      { expiresIn } as jwt.SignOptions
    )

    console.log('[Email] new-user check — enableEmailNotifications:', settings.enableEmailNotifications, '| notifyOnNewUser:', settings.notifyOnNewUser)
    if (settings.enableEmailNotifications && settings.notifyOnNewUser) {
      emailService.send({
        to: settings.supportEmail || undefined,
        subject: `[Beatific Admin] New admin registered: ${name}`,
        text: `A new admin account was created.\n\nName: ${name}\nEmail: ${email}\nRole: ${user.role}\nTime: ${new Date().toISOString()}`,
      }).then(() => console.log('[Email] new-user notification sent')).catch(err => console.warn('[Email] Failed to send new-user notification:', err.message))
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    }
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials
    const settings = await settingsService.get()

    const user = await AdminUser.findOne({ email })
    if (!user) {
      const err: any = new Error('Invalid email or password')
      err.statusCode = 401
      throw err
    }

    if (user.isBanned) {
      const err: any = new Error('Your account has been banned. Contact an administrator.')
      err.statusCode = 403
      throw err
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      const err: any = new Error(`Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`)
      err.statusCode = 429
      throw err
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1
      const maxAttempts = settings.maxLoginAttempts ?? 10

      if (attempts >= maxAttempts) {
        await AdminUser.findByIdAndUpdate(user._id, {
          failedLoginAttempts: attempts,
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
        })
        const err: any = new Error(`Account locked after ${maxAttempts} failed attempts. Try again in 30 minutes.`)
        err.statusCode = 429
        throw err
      } else {
        await AdminUser.findByIdAndUpdate(user._id, { failedLoginAttempts: attempts })
        const remaining = maxAttempts - attempts
        const err: any = new Error(`Invalid email or password. ${remaining} attempt(s) remaining before lockout.`)
        err.statusCode = 401
        throw err
      }
    }

    await AdminUser.findByIdAndUpdate(user._id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastActiveAt: new Date(),
    })

    const expiresIn = `${settings.sessionTimeoutHours ?? 168}h`
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role, sg: settings.sessionGeneration ?? 0 },
      JWT_SECRET,
      { expiresIn } as jwt.SignOptions
    )

    if (settings.enableEmailNotifications && settings.notifyOnLogin) {
      emailService.send({
        to: settings.supportEmail || undefined,
        subject: `[Beatific Admin] Admin login: ${user.name}`,
        text: `An admin logged in.\n\nName: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}\nTime: ${new Date().toISOString()}`,
      }).then(() => console.log('[Email] admin-login notification sent')).catch(err => console.warn('[Email] Failed to send login notification:', err.message))
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    }
  },

  async getProfile(userId: string): Promise<Omit<AuthResponse, 'token'> & { bio?: string; avatar?: string }> {
    const user = await AdminUser.findById(userId).select('-password')
    if (!user) {
      const err: any = new Error('User not found')
      err.statusCode = 404
      throw err
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      bio: user.bio ?? '',
      avatar: user.avatar ?? '',
    }
  },
}
