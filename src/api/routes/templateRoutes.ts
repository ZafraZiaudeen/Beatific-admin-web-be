import { Router } from 'express'
import { TemplateService } from '../../application/templateService'
import type { Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/authMiddleware'

const router       = Router()
const templateSvc  = new TemplateService()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await templateSvc.list(req.query as Record<string, string>)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateSvc.getById(req.params.id)
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: template })
  } catch (err) { next(err) }
})

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateSvc.create(req.body)
    res.status(201).json({ success: true, data: template })
  } catch (err) { next(err) }
})

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateSvc.update(req.params.id, req.body)
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: template })
  } catch (err) { next(err) }
})

router.put('/:id/pages', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pages } = req.body
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: '`pages` must be an array' })
    }
    const template = await templateSvc.savePages(req.params.id, pages)
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: template })
  } catch (err) { next(err) }
})

router.post('/:id/pages', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateSvc.addPage(req.params.id, req.body)
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' })
    res.status(201).json({ success: true, data: template })
  } catch (err) { next(err) }
})

router.patch('/:id/publish', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isPublished } = req.body
    const template = await templateSvc.publish(req.params.id, Boolean(isPublished))
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: template })
  } catch (err) { next(err) }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedBy = (req as any).admin?.id ?? undefined
    const preserveRaw = (req.query.preserveForUsers ?? (req as any).body?.preserveForUsers) as
      | string
      | boolean
      | undefined
    const preserveForUsers =
      preserveRaw === undefined ? true : (String(preserveRaw).toLowerCase() === 'true')

    const result = await templateSvc.delete(req.params.id, deletedBy, preserveForUsers)
    if (!result.deleted) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }

    let message = 'Template permanently deleted.'
    if (result.snapshotCreated) {
      message = `Template permanently deleted. A snapshot was preserved for ${result.journalRefCount} existing journal reference(s).`
    } else if (!result.preserveForUsers && result.journalsRemoved > 0) {
      message = `Template permanently deleted. Removed ${result.journalsRemoved} journal reference(s).`
    }

    res.json({
      success: true,
      message,
      data: {
        templateId: result.templateId,
        snapshotCreated: result.snapshotCreated,
        journalRefCount: result.journalRefCount,
        journalsRemoved: result.journalsRemoved,
        preserveForUsers: result.preserveForUsers,
      },
    })
  } catch (err) { next(err) }
})

export default router
