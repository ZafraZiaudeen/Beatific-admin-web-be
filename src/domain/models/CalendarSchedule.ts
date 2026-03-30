import { Schema, model } from 'mongoose'
import type { ICalendarSchedule } from '../interfaces/ICalendarSchedule'

const RecurrenceSchema = new Schema(
  {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    interval: { type: Number, required: true, min: 1, default: 1 },
    weekdays: { type: [String], default: undefined },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    startDate: { type: String, required: true },
    endDate: { type: String },
  },
  { _id: false }
)

const CalendarScheduleSchema = new Schema<ICalendarSchedule>(
  {
    contentId: { type: String, required: true, trim: true },
    mode: { type: String, enum: ['exact', 'recurring'], required: true },
    exactDate: { type: String },
    recurrence: { type: RecurrenceSchema },
    slotLabel: { type: String, trim: true },
    startTime: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    revision: { type: Number, default: 1 },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
)

CalendarScheduleSchema.index({ contentId: 1, isActive: 1 })
CalendarScheduleSchema.index({ mode: 1, isActive: 1 })
CalendarScheduleSchema.index({ exactDate: 1, isActive: 1 })

export const CalendarSchedule = model<ICalendarSchedule>('CalendarSchedule', CalendarScheduleSchema)
