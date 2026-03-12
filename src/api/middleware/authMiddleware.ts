import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '../../domain/interfaces/IAuth'

const JWT_SECRET = process.env.JWT_SECRET ?? 'beatific-admin-secret-key-change-in-production'

declare global {
  namespace Express {
    interface Request {
      admin?: AuthPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'No token provided' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    req.admin = decoded
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token is invalid or expired' })
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.admin?.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Super-admin access required' })
      return
    }
    next()
  })
}

export function requireAdminOrAbove(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!['super_admin', 'admin'].includes(req.admin?.role ?? '')) {
      res.status(403).json({ success: false, message: 'Admin access required' })
      return
    }
    next()
  })
}
