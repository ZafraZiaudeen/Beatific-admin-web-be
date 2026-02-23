import { Router } from 'express'
import type { Request, Response } from 'express'
import { authService } from '../../application/authService'
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

export default authRouter
