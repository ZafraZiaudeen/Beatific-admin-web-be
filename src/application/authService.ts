import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AdminUser } from '../domain/models/AdminUser'
import type { LoginCredentials, RegisterCredentials, AuthResponse } from '../domain/interfaces/IAuth'

const JWT_SECRET = process.env.JWT_SECRET ?? 'beatific-admin-secret-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'

export const authService = {
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { name, email, password } = credentials

    const existing = await AdminUser.findOne({ email })
    if (existing) {
      const err: any = new Error('An account with this email already exists')
      err.statusCode = 409
      throw err
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await AdminUser.create({
      name,
      email,
      password: hashedPassword,
    })

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    )

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    }
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials

    const user = await AdminUser.findOne({ email })
    if (!user) {
      const err: any = new Error('Invalid email or password')
      err.statusCode = 401
      throw err
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      const err: any = new Error('Invalid email or password')
      err.statusCode = 401
      throw err
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    )

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    }
  },

  async getProfile(userId: string): Promise<Omit<AuthResponse, 'token'>> {
    const user = await AdminUser.findById(userId).select('-password')
    if (!user) {
      const err: any = new Error('User not found')
      err.statusCode = 404
      throw err
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    }
  },
}
