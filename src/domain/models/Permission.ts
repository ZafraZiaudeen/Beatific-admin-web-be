import { Schema, model } from 'mongoose'

export interface IPermission {
  _id?: string
  scope: string
  targetType: string
  enabled: boolean
  placementRole?: 'primary' | 'secondary'
  allowedCategories?: string[]   
  allowedItems?: string[]        
  updatedAt?: Date
  createdAt?: Date
}

const PermissionSchema = new Schema<IPermission>(
  {
    scope:             { type: String, required: true, trim: true, lowercase: true },
    targetType:        { type: String, required: true, trim: true, lowercase: true },
    enabled:           { type: Boolean, default: true },
    placementRole:     { type: String, enum: ['primary', 'secondary', null], default: null },
    allowedCategories: { type: [String], default: [] },
    allowedItems:      { type: [String], default: [] },
  },
  { timestamps: true }
)

PermissionSchema.index({ scope: 1, targetType: 1 }, { unique: true })

export const Permission = model<IPermission>('Permission', PermissionSchema)
