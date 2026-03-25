import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { dashboardService } from '../../application/dashboardService'

const router = Router()

router.get('/overview', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawDays = Number(req.query.days ?? 30)
    const days = Number.isFinite(rawDays) ? rawDays : 30
    const data = await dashboardService.getOverview(days)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

export default router
