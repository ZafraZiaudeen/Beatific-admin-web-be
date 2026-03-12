import bcrypt from 'bcryptjs'
import { AdminUser } from '../domain/models/AdminUser'
import { AppUser } from '../domain/models/AppUser'

export type AdminRole = 'super_admin' | 'admin' | 'editor'

export interface UserListParams {
  page?: number
  limit?: number
  search?: string
}

export interface CreateAdminUserParams {
  name: string
  email: string
  password: string
  role?: AdminRole
}

export interface CreateAppUserParams {
  name: string
  email: string
  password: string
}

const PAGE_SIZE = 20

export const adminUserService = {

  async list({ page = 1, limit = PAGE_SIZE, search = '' }: UserListParams) {
    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {}
    const [users, total] = await Promise.all([
      AdminUser.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminUser.countDocuments(query),
    ])
    return { users, total, page, limit, pages: Math.ceil(total / limit) }
  },

  async create({ name, email, password, role = 'admin' }: CreateAdminUserParams) {
    const existing = await AdminUser.findOne({ email: email.toLowerCase().trim() })
    if (existing) throw Object.assign(new Error('An admin with this email already exists'), { statusCode: 409 })

    if (password.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { statusCode: 400 })

    const hashed = await bcrypt.hash(password, 10)
    const user = await AdminUser.create({ name, email, password: hashed, role })
    const { password: _pw, ...safe } = user.toObject()
    return safe
  },

  async updateRole(id: string, role: AdminRole) {
    const user = await AdminUser.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password')
    if (!user) throw Object.assign(new Error('Admin user not found'), { statusCode: 404 })
    return user
  },

  async toggleBan(id: string) {
    const user = await AdminUser.findById(id)
    if (!user) throw Object.assign(new Error('Admin user not found'), { statusCode: 404 })
    user.isBanned = !user.isBanned
    await user.save()
    const { password: _pw, ...safe } = user.toObject()
    return safe
  },

  async resetPassword(id: string, newPassword: string) {
    if (newPassword.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { statusCode: 400 })
    const hashed = await bcrypt.hash(newPassword, 10)
    const user = await AdminUser.findByIdAndUpdate(id, { password: hashed }, { new: true }).select('-password')
    if (!user) throw Object.assign(new Error('Admin user not found'), { statusCode: 404 })
    return { message: 'Password reset successfully' }
  },

  async delete(id: string, requesterId: string) {
    if (id === requesterId) throw Object.assign(new Error('You cannot delete your own account'), { statusCode: 400 })
    const user = await AdminUser.findByIdAndDelete(id)
    if (!user) throw Object.assign(new Error('Admin user not found'), { statusCode: 404 })
    return { message: 'Admin user deleted' }
  },

  async deleteMany(ids: string[], requesterId: string) {
    const filtered = ids.filter(id => id !== requesterId)
    if (filtered.length === 0) throw Object.assign(new Error('Cannot delete only your own account'), { statusCode: 400 })
    const result = await AdminUser.deleteMany({ _id: { $in: filtered } })
    return { message: `${result.deletedCount} admin user(s) deleted` }
  },
}

export const appUserService = {

  async list({ page = 1, limit = PAGE_SIZE, search = '' }: UserListParams) {
    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {}
    const [users, total] = await Promise.all([
      AppUser.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AppUser.countDocuments(query),
    ])
    return { users, total, page, limit, pages: Math.ceil(total / limit) }
  },

  async create({ name, email, password }: CreateAppUserParams) {
    const existing = await AppUser.findOne({ email: email.toLowerCase().trim() })
    if (existing) throw Object.assign(new Error('A user with this email already exists'), { statusCode: 409 })

    if (password.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { statusCode: 400 })

    const hashed = await bcrypt.hash(password, 10)
    const user = await AppUser.create({ name, email, password: hashed })
    const { password: _pw, ...safe } = user.toObject()
    return safe
  },

  async toggleBan(id: string) {
    const user = await AppUser.findById(id)
    if (!user) throw Object.assign(new Error('App user not found'), { statusCode: 404 })
    user.isBanned = !user.isBanned
    await user.save()
    const { password: _pw, ...safe } = user.toObject()
    return safe
  },

  async resetPassword(id: string, newPassword: string) {
    if (newPassword.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { statusCode: 400 })
    const hashed = await bcrypt.hash(newPassword, 10)
    const user = await AppUser.findByIdAndUpdate(id, { password: hashed }, { new: true }).select('-password')
    if (!user) throw Object.assign(new Error('App user not found'), { statusCode: 404 })
    return { message: 'Password reset successfully' }
  },

  async delete(id: string) {
    const user = await AppUser.findByIdAndDelete(id)
    if (!user) throw Object.assign(new Error('App user not found'), { statusCode: 404 })
    return { message: 'App user deleted' }
  },

  async deleteMany(ids: string[]) {
    const result = await AppUser.deleteMany({ _id: { $in: ids } })
    return { message: `${result.deletedCount} app user(s) deleted` }
  },
}
