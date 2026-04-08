import { Router } from 'express'
import { calendarScheduleService } from '../../application/calendarScheduleService'
import { requireAuth } from '../middleware/authMiddleware'

const router = Router()

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const data = await calendarScheduleService.list()
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.post('/preview', requireAuth, async (req, res, next) => {
  try {
    const data = await calendarScheduleService.preview(req.body ?? {})
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = await calendarScheduleService.create(req.body ?? {}, req.admin?.id)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const data = await calendarScheduleService.update(req.params.id, req.body ?? {})
    if (!data) {
      res.status(404).json({ success: false, message: 'Schedule not found' })
      return
    }
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await calendarScheduleService.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Schedule not found' })
      return
    }
    res.json({ success: true, message: 'Schedule deleted' })
  } catch (err) { next(err) }
})

export default router
