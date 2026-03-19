import { Schema, model, Document } from 'mongoose'

/**
 * DeletedTemplateSnapshot persists a full copy of a Template document
 * at the moment an admin permanently deletes it.
 *
 * Purpose:
 *  - Allow existing journal entries that reference the now‑deleted
 *    template to continue displaying it as it appeared before deletion.
 *  - Block new journal copies from being created once the source
 *    template has been removed.
 *
 * This is NOT a soft‑delete flag and must NEVER be used to un‑delete
 * templates or restore them to the primary Template collection.
 */

export interface IDeletedTemplateSnapshot extends Document {
  /** Original _id of the deleted Template document */
  sourceTemplateId: string
  /** Full serialized Template document at time of deletion */
  snapshot: Record<string, unknown>
  /** Timestamp of the admin deletion */
  deletedAt: Date
  /** Admin user who performed the deletion (optional traceability) */
  deletedBy?: string
  /** Number of journals that referenced this template at deletion time */
  journalRefCount: number
}

const DeletedTemplateSnapshotSchema = new Schema<IDeletedTemplateSnapshot>(
  {
    sourceTemplateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    deletedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    deletedBy: {
      type: String,
    },
    journalRefCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: false }
)

export const DeletedTemplateSnapshot = model<IDeletedTemplateSnapshot>(
  'DeletedTemplateSnapshot',
  DeletedTemplateSnapshotSchema,
)
