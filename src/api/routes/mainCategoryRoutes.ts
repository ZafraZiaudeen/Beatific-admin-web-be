import { Router } from 'express'
import { MainCategoryService } from '../../application/mainCategoryService'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'

const router         = Router()
const mainCatService = new MainCategoryService()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await mainCatService.list()
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mainCat = await mainCatService.getById(req.params.id)
    if (!mainCat) return res.status(404).json({ success: false, message: 'Main category not found' })
    res.json({ success: true, data: mainCat })
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mainCat = await mainCatService.create(req.body)
    res.status(201).json({ success: true, data: mainCat })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mainCat = await mainCatService.update(req.params.id, req.body)
    if (!mainCat) return res.status(404).json({ success: false, message: 'Main category not found' })
    res.json({ success: true, data: mainCat })
  } catch (err) { next(err) }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await mainCatService.delete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: 'Main category not found' })
    res.json({ success: true, message: 'Main category and all its subcategories deleted' })
  } catch (err) { next(err) }
})

export default router
