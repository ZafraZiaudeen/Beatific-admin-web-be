import { Document, Schema, model } from 'mongoose'

export interface IAppUser extends Document {
  name: string
  email: string
  password: string
  avatar?: string
  bio?: string
  isBanned: boolean
  lastActiveAt?: Date
  createdAt: Date
  updatedAt: Date
}

const appUserSchema = new Schema<IAppUser>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar:   { type: String },
    bio:      { type: String, maxlength: 300 },
    isBanned: { type: Boolean, default: false },
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
)

export const AppUser = model<IAppUser>('AppUser', appUserSchema)
