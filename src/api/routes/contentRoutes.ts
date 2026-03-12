import { Router } from 'express'
import { contentService } from '../../application/contentService'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'

const router = Router()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemType, category, subcategory, search, isPublished } = req.query as Record<string, string>
    const result = await contentService.list({
      itemType,
      category,
      subcategory,
      search,
      isPublished: isPublished === 'true' ? true : isPublished === 'false' ? false : undefined,
    })
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await contentService.getStats()
    res.json({ success: true, data: stats })
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await contentService.getById(req.params.id)
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' })
    res.json({ success: true, data: content })
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await contentService.create(req.body)
    res.status(201).json({ success: true, data: content })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await contentService.update(req.params.id, req.body)
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' })
    res.json({ success: true, data: content })
  } catch (err) { next(err) }
})

router.put('/:id/pages', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pages, svgContent } = req.body
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: '`pages` must be an array' })
    }
    const content = await contentService.savePages(req.params.id, pages, svgContent)
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' })
    res.json({ success: true, data: content })
  } catch (err) { next(err) }
})

router.patch('/:id/publish', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isPublished } = req.body
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ success: false, message: '`isPublished` must be a boolean' })
    }
    const content = await contentService.publish(req.params.id, isPublished)
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' })
    res.json({ success: true, data: content })
  } catch (err) { next(err) }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await contentService.delete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: 'Content not found' })
    res.json({ success: true, message: 'Content deleted' })
  } catch (err) { next(err) }
})

export default router
