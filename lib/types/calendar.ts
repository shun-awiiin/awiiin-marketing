import { z } from 'zod'

// ============================================
// ENUMS
// ============================================

export type CalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled'
export type ReminderType = 'email' | 'notification'

// ============================================
// TABLE TYPES
// ============================================

export interface CalendarConnection {
  id: string
  user_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
  calendar_id: string
  sync_enabled: boolean
  sync_token: string | null
  last_synced_at: string | null
  google_email: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  google_event_id: string
  summary: string | null
  description: string | null
  start_at: string
  end_at: string
  location: string | null
  meet_link: string | null
  attendee_emails: string[]
  contact_ids: string[]
  status: CalendarEventStatus
  is_all_day: boolean
  organizer_email: string | null
  synced_at: string
  created_at: string
  updated_at: string
}

export interface MeetingReminder {
  id: string
  user_id: string
  event_id: string
  remind_before_minutes: number
  reminder_type: ReminderType
  sent_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// API TYPES
// ============================================

export interface CalendarConnectionStatus {
  connected: boolean
  google_email: string | null
  sync_enabled: boolean
  last_synced_at: string | null
  calendar_id: string
}

export interface CalendarEventWithContacts extends CalendarEvent {
  matched_contacts: {
    id: string
    email: string
    name: string | null
  }[]
}

export interface UpcomingMeeting {
  id: string
  summary: string | null
  start_at: string
  end_at: string
  meet_link: string | null
  attendee_count: number
  matched_contact_count: number
}

// ============================================
// GOOGLE CALENDAR API TYPES
// ============================================

export interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: {
      entryPointType: string
      uri: string
    }[]
  }
  attendees?: {
    email: string
    responseStatus?: string
    self?: boolean
    organizer?: boolean
  }[]
  organizer?: {
    email: string
    self?: boolean
  }
  status?: string
  htmlLink?: string
}

export interface GoogleCalendarListResponse {
  items: GoogleCalendarEvent[]
  nextSyncToken?: string
  nextPageToken?: string
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const CalendarSettingsSchema = z.object({
  sync_enabled: z.boolean(),
  calendar_id: z.string().min(1, 'カレンダーIDを入力してください').default('primary'),
})

export const CreateReminderSchema = z.object({
  event_id: z.string().uuid('有効なイベントIDを指定してください'),
  remind_before_minutes: z.number().int().min(1).max(10080),
  reminder_type: z.enum(['email', 'notification']),
})

export const UpdateReminderSchema = z.object({
  remind_before_minutes: z.number().int().min(1).max(10080).optional(),
  reminder_type: z.enum(['email', 'notification']).optional(),
})

export const CalendarSyncQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
})

export const CalendarEventsQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
})
