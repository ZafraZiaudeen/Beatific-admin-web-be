import { Router } from 'express'
import { CategoryService } from '../../application/categoryService'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'

const router      = Router()
const categorySvc = new CategoryService()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemType } = req.query as { itemType?: string }
    const data = await categorySvc.list(itemType)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categorySvc.create(req.body)
    res.status(201).json({ success: true, data: category })
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => { // public
  try {
    const category = await categorySvc.getById(req.params.id)
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' })
    res.json({ success: true, data: category })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categorySvc.update(req.params.id, req.body)
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' })
    res.json({ success: true, data: category })
  } catch (err) { next(err) }
})

router.post('/:id/subcategories', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categorySvc.addSubcategory(req.params.id, req.body)
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' })
    res.status(201).json({ success: true, data: category })
  } catch (err) { next(err) }
})

router.delete('/:id/subcategories/:slug', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categorySvc.removeSubcategory(req.params.id, req.params.slug)
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' })
    res.json({ success: true, data: category })
  } catch (err) { next(err) }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await categorySvc.delete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' })
    res.json({ success: true, message: 'Category deleted' })
  } catch (err) { next(err) }
})

export default router
