import { z } from 'zod'

// ============================================
// ACTIVITY TYPES
// ============================================

export type ActivityType =
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'email_bounced'
  | 'form_submitted'
  | 'chat_started'
  | 'chat_message'
  | 'tag_added'
  | 'tag_removed'
  | 'scenario_enrolled'
  | 'note_added'
  | 'contact_created'

// ============================================
// TABLE TYPES
// ============================================

export interface ContactActivity {
  id: string
  contact_id: string
  user_id: string
  activity_type: ActivityType
  title: string
  description: string | null
  metadata: Record<string, unknown>
  reference_type: string | null
  reference_id: string | null
  occurred_at: string
  created_at: string
}

export interface ContactNote {
  id: string
  contact_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface TimelineResponse {
  data: ContactActivity[]
  meta: {
    total: number
    page: number
    per_page: number
    has_more: boolean
  }
}

export interface NotesResponse {
  data: ContactNote[]
  meta: {
    total: number
  }
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const CreateNoteSchema = z.object({
  content: z.string().min(1, 'ノートの内容を入力してください').max(5000, 'ノートは5000文字以内で入力してください'),
})

export const UpdateNoteSchema = z.object({
  content: z.string().min(1, 'ノートの内容を入力してください').max(5000, 'ノートは5000文字以内で入力してください'),
})

export const TimelineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  activity_type: z.string().optional(),
})
