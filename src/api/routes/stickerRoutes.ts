import { Router } from 'express'
import { StickerService } from '../../application/stickerService'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'

const router     = Router()
const stickerSvc = new StickerService()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await stickerSvc.list(req.query as Record<string, string>)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sticker = await stickerSvc.getById(req.params.id)
    if (!sticker) return res.status(404).json({ success: false, message: 'Sticker not found' })
    res.json({ success: true, data: sticker })
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sticker = await stickerSvc.create(req.body)
    res.status(201).json({ success: true, data: sticker })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sticker = await stickerSvc.update(req.params.id, req.body)
    if (!sticker) return res.status(404).json({ success: false, message: 'Sticker not found' })
    res.json({ success: true, data: sticker })
  } catch (err) { next(err) }
})

router.put('/:id/pages', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pages, svgContent } = req.body
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: '`pages` must be an array' })
    }
    const sticker = await stickerSvc.savePages(req.params.id, pages, svgContent)
    if (!sticker) return res.status(404).json({ success: false, message: 'Sticker not found' })
    res.json({ success: true, data: sticker })
  } catch (err) { next(err) }
})

router.patch('/:id/publish', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isPublished } = req.body
    const sticker = await stickerSvc.publish(req.params.id, Boolean(isPublished))
    if (!sticker) return res.status(404).json({ success: false, message: 'Sticker not found' })
    res.json({ success: true, data: sticker })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await stickerSvc.delete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: 'Sticker not found' })
    res.json({ success: true, message: 'Sticker deleted' })
  } catch (err) { next(err) }
})

export default router
