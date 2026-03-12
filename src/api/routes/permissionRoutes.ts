import { Router } from 'express'
import { permissionService } from '../../application/permissionService'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'

const router = Router()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scope } = req.query as { scope?: string }
    const data = await permissionService.list(scope)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.get('/:scope/:targetType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const perm = await permissionService.get(req.params.scope, req.params.targetType)
    if (!perm) return res.status(404).json({ success: false, message: 'Permission not found' })
    res.json({ success: true, data: perm })
  } catch (err) { next(err) }
})

router.put('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scope, targetType, enabled, placementRole, allowedCategories, allowedItems } = req.body
    if (!scope || !targetType) {
      return res.status(400).json({ success: false, message: '`scope` and `targetType` are required' })
    }
    const perm = await permissionService.upsert(scope, targetType, {
      enabled, placementRole, allowedCategories, allowedItems,
    })
    res.json({ success: true, data: perm })
  } catch (err) { next(err) }
})

router.put('/bulk', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { permissions } = req.body
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: '`permissions` must be an array' })
    }
    const data = await permissionService.bulkUpsert(permissions)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.delete('/:scope/:targetType', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await permissionService.delete(req.params.scope, req.params.targetType)
    if (!deleted) return res.status(404).json({ success: false, message: 'Permission not found' })
    res.json({ success: true, message: 'Permission deleted' })
  } catch (err) { next(err) }
})

export default router
