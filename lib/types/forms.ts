import { z } from 'zod'

// ============================================
// Field & Status Types
// ============================================

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'hidden'

export type FormStatus = 'draft' | 'active' | 'archived'

export interface FormField {
  id: string
  type: FormFieldType
  label: string
  name: string
  placeholder?: string
  required: boolean
  options?: string[]
  defaultValue?: string
}

export interface FormSettings {
  submitLabel: string
  successMessage: string
  redirectUrl: string | null
  notifyEmail: string | null
  autoReplyEnabled: boolean
  autoReplySubject: string
  autoReplyBody: string | null
  autoReplyTemplateId: string | null
  scenarioId: string | null
  tagIds: string[]
}

export interface StandaloneForm {
  id: string
  user_id: string
  name: string
  slug: string
  description: string | null
  status: FormStatus
  fields: FormField[]
  settings: FormSettings
  style: Record<string, string>
  submission_count: number
  created_at: string
  updated_at: string
}

export interface StandaloneFormSubmission {
  id: string
  form_id: string
  user_id: string
  contact_id: string | null
  form_data: Record<string, unknown>
  utm_params: Record<string, string>
  ip_address: string | null
  user_agent: string | null
  submitted_at: string
}

// ============================================
// Zod Schemas
// ============================================

const FormFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'hidden']),
  label: z.string().min(1),
  name: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
})

const FormSettingsSchema = z.object({
  submitLabel: z.string().default('送信'),
  successMessage: z.string().default('送信が完了しました。ありがとうございます。'),
  redirectUrl: z.string().url().nullable().default(null),
  notifyEmail: z.string().email().nullable().default(null),
  autoReplyEnabled: z.boolean().default(false),
  autoReplySubject: z.string().default('お問い合わせありがとうございます'),
  autoReplyBody: z.string().nullable().default(null),
  autoReplyTemplateId: z.string().nullable().default(null),
  scenarioId: z.string().uuid().nullable().default(null),
  tagIds: z.array(z.string().uuid()).default([]),
})

export const CreateFormSchema = z.object({
  name: z.string().min(1, 'フォーム名は必須です').max(255),
  description: z.string().nullable().optional(),
  fields: z.array(FormFieldSchema).default([]),
  settings: FormSettingsSchema.optional(),
  style: z.record(z.string()).optional(),
})

export const UpdateFormSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  fields: z.array(FormFieldSchema).optional(),
  settings: FormSettingsSchema.partial().optional(),
  style: z.record(z.string()).optional(),
})

export const SubmitFormSchema = z.object({
  data: z.record(z.unknown()),
  utm_params: z.record(z.string()).optional(),
})

export { FormFieldSchema, FormSettingsSchema }
