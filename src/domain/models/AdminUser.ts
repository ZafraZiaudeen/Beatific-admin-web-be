import { Schema, model, Document } from 'mongoose'

export interface IAdminUser extends Document {
  name: string
  email: string
  password: string
  role: 'super_admin' | 'admin' | 'editor'
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
  },
  { timestamps: true }
)

export const AdminUser = model<IAdminUser>('AdminUser', adminUserSchema)
