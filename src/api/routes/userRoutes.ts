import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { adminUserService, appUserService } from '../../application/userService'
import { requireAuth, requireSuperAdmin, requireAdminOrAbove } from '../middleware/authMiddleware'

const router = Router()


router.get('/admin', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(req.query.page  as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = (req.query.search as string) ?? ''
    const data = await adminUserService.list({ page, limit, search })
    res.json({ success: true, ...data })
  } catch (err) { next(err) }
})

router.post('/admin', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body
    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'name, email and password are required' })
      return
    }
    const user = await adminUserService.create({ name, email, password, role })
    res.status(201).json({ success: true, data: user })
  } catch (err) { next(err) }
})

router.patch('/admin/:id/role', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body
    if (!['super_admin', 'admin', 'editor'].includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role. Must be super_admin, admin, or editor' })
      return
    }
    const user = await adminUserService.updateRole(req.params.id, role)
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

router.patch('/admin/:id/ban', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await adminUserService.toggleBan(req.params.id)
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

router.patch('/admin/:id/password', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPassword } = req.body
    if (!newPassword) {
      res.status(400).json({ success: false, message: 'newPassword is required' })
      return
    }
    const result = await adminUserService.resetPassword(req.params.id, newPassword)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.delete('/admin/bulk', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'ids array is required' })
      return
    }
    const requesterId = req.admin!.id
    const result = await adminUserService.deleteMany(ids, requesterId)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

// DELETE /users/admin/:id  — delete admin user  (admin or above)
router.delete('/admin/:id', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requesterId = req.admin!.id
    const result = await adminUserService.delete(req.params.id, requesterId)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.get('/app', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(req.query.page  as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = (req.query.search as string) ?? ''
    const data = await appUserService.list({ page, limit, search })
    res.json({ success: true, ...data })
  } catch (err) { next(err) }
})

router.post('/app', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'name, email and password are required' })
      return
    }
    const user = await appUserService.create({ name, email, password })
    res.status(201).json({ success: true, data: user })
  } catch (err) { next(err) }
})

router.patch('/app/:id/ban', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await appUserService.toggleBan(req.params.id)
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

router.patch('/app/:id/password', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPassword } = req.body
    if (!newPassword) {
      res.status(400).json({ success: false, message: 'newPassword is required' })
      return
    }
    const result = await appUserService.resetPassword(req.params.id, newPassword)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

// DELETE /users/app/bulk  — bulk delete app users  (admin or above)
router.delete('/app/bulk', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'ids array is required' })
      return
    }
    const result = await appUserService.deleteMany(ids)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.delete('/app/:id', requireAdminOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await appUserService.delete(req.params.id)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

export default router
