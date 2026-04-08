export type CalendarScheduleMode = 'exact' | 'recurring'
export type CalendarScheduleVisibilityMode = 'date-only' | 'always-visible'

export type CalendarRecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

export interface ICalendarRecurrence {
  frequency: CalendarRecurrenceFrequency
  interval: number
  weekdays?: string[]
  dayOfMonth?: number
  startDate: string
  endDate?: string
}

export interface ICalendarSchedule {
  _id?: string
  contentId: string
  mode: CalendarScheduleMode
  visibilityMode?: CalendarScheduleVisibilityMode
  exactDate?: string
  exactEndDate?: string
  recurrence?: ICalendarRecurrence
  slotLabel?: string
  startTime?: string
  isActive: boolean
  revision: number
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
}
