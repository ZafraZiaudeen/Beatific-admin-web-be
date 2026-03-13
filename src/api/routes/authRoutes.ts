import { Router } from 'express'
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { authService } from '../../application/authService'
import { AdminUser } from '../../domain/models/AdminUser'
import { settingsService } from '../../application/settingsService'
import { requireAuth } from '../middleware/authMiddleware'

const authRouter = Router()

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Name, email, and password are required' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' })
      return
    }

    const result = await authService.register({ name, email, password })
    res.status(201).json({ success: true, ...result })
  } catch (err: any) {
    const status = err.statusCode ?? 500
    res.status(status).json({ success: false, message: err.message ?? 'Registration failed' })
  }
})

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' })
      return
    }

    const result = await authService.login({ email, password })
    res.status(200).json({ success: true, ...result })
  } catch (err: any) {
    const status = err.statusCode ?? 500
    res.status(status).json({ success: false, message: err.message ?? 'Login failed' })
  }
})

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.admin!.id
    const user = await authService.getProfile(userId)
    res.status(200).json({ success: true, ...user })
  } catch (err: any) {
    const status = err.statusCode ?? 500
    res.status(status).json({ success: false, message: err.message ?? 'Failed to fetch profile' })
  }
})

/** PUT /auth/profile — update own name / email / bio / avatar */
authRouter.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.admin!.id
    const { name, email, bio, avatar } = req.body
    if (!name && !email && bio === undefined && avatar === undefined) {
      res.status(400).json({ success: false, message: 'Provide at least one field to update' })
      return
    }
    const updates: Record<string, string> = {}
    if (name?.trim())   updates.name   = name.trim()
    if (bio !== undefined)    updates.bio    = String(bio ?? '').trim()
    if (avatar !== undefined) updates.avatar = String(avatar ?? '').trim()
    if (email?.trim()) {
      const conflict = await AdminUser.findOne({ email: email.toLowerCase().trim(), _id: { $ne: userId } })
      if (conflict) {
        res.status(409).json({ success: false, message: 'Another account with this email already exists' })
        return
      }
      updates.email = email.toLowerCase().trim()
    }
    const user = await AdminUser.findByIdAndUpdate(userId, updates, { new: true }).select('-password')
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    res.json({ success: true, _id: user._id, name: user.name, email: user.email, role: user.role, bio: user.bio, avatar: user.avatar })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to update profile' })
  }
})

const handleChangePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.admin!.id
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current password and new password are required' })
      return
    }
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters' })
      return
    }
    const settings = await settingsService.get()
    if (settings.requireStrongPassword) {
      const hasUpper  = /[A-Z]/.test(newPassword)
      const hasNumber = /\d/.test(newPassword)
      const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword)
      if (!hasUpper || !hasNumber || !hasSymbol || newPassword.length < 6) {
        res.status(400).json({ success: false, message: 'Password must include uppercase letters, numbers, and special characters' })
        return
      }
    }
    const user = await AdminUser.findById(userId)
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' })
      return
    }
    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()
    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ success: false, message: err.message ?? 'Failed to change password' })
  }
}

/** PUT|POST /auth/change-password — change own password */
authRouter.put('/change-password', requireAuth, handleChangePassword)
authRouter.post('/change-password', requireAuth, handleChangePassword)

export default authRouter
