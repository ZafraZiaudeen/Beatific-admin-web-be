import { Schema, model, Document } from 'mongoose'

export interface IAdminUser extends Document {
  name: string
  email: string
  password: string
  role: 'super_admin' | 'admin' | 'editor'
  isBanned: boolean
  bio?: string
  avatar?: string
  failedLoginAttempts: number
  lockedUntil?: Date
  lastActiveAt?: Date
  createdAt: Date
  updatedAt: Date
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'editor'],
      default: 'admin',
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    lastActiveAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

export const AdminUser = model<IAdminUser>('AdminUser', adminUserSchema)
