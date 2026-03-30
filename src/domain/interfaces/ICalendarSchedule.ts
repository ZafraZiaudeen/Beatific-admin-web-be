export type CalendarScheduleMode = 'exact' | 'recurring'

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
  exactDate?: string
  recurrence?: ICalendarRecurrence
  slotLabel?: string
  startTime?: string
  isActive: boolean
  revision: number
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
}
