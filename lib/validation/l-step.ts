import { z } from 'zod'

// ============================================
// ENUMS
// ============================================

export const scenarioStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export const stepTypeSchema = z.enum(['email', 'wait', 'condition', 'line', 'action'])
export const triggerTypeSchema = z.enum(['signup', 'tag_added', 'tag_removed', 'form_submit', 'manual'])
export const conditionTypeSchema = z.enum(['opened', 'clicked', 'not_opened', 'not_clicked', 'has_tag', 'custom_field'])
export const enrollmentStatusSchema = z.enum(['active', 'completed', 'paused', 'exited'])
export const fieldTypeSchema = z.enum(['text', 'number', 'date', 'boolean', 'select'])

// ============================================
// SCENARIOS
// ============================================

export const createScenarioSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255, '名前は255文字以内で入力してください'),
  description: z.string().max(1000).optional(),
  trigger_type: triggerTypeSchema.optional().default('manual'),
  trigger_config: z.record(z.unknown()).optional().default({})
})

export const updateScenarioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: scenarioStatusSchema.optional(),
  trigger_type: triggerTypeSchema.optional(),
  trigger_config: z.record(z.unknown()).optional()
})

// ============================================
// STEPS
// ============================================

export const stepConfigSchema = z.object({
  // Email step
  template_id: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  content: z.string().optional(),
  from_name: z.string().max(100).optional(),
  from_email: z.string().email().optional(),
  // Wait step
  wait_value: z.number().int().min(1).max(365).optional(),
  wait_unit: z.enum(['minutes', 'hours', 'days']).optional(),
  // LINE step
  line_message_type: z.enum(['text', 'flex', 'template']).optional(),
  line_content: z.object({
    text: z.string().optional(),
    altText: z.string().optional(),
    contents: z.record(z.unknown()).optional()
  }).optional(),
  // Action step
  action_type: z.enum(['add_tag', 'remove_tag', 'update_field']).optional(),
  action_config: z.record(z.unknown()).optional()
}).passthrough()

export const conditionConfigSchema = z.object({
  timeout_value: z.number().int().min(1).optional(),
  timeout_unit: z.enum(['minutes', 'hours', 'days']).optional(),
  email_id: z.string().optional(),
  step_id: z.string().uuid().optional(),
  tag_id: z.string().uuid().optional(),
  field_id: z.string().uuid().optional(),
  field_operator: z.enum(['equals', 'not_equals', 'contains', 'greater', 'less']).optional(),
  field_value: z.string().optional()
})

export const createStepSchema = z.object({
  step_type: stepTypeSchema,
  name: z.string().max(255).optional(),
  config: stepConfigSchema.optional().default({}),
  condition_type: conditionTypeSchema.optional(),
  condition_config: conditionConfigSchema.optional()
})

export const updateStepSchema = z.object({
  name: z.string().max(255).optional(),
  config: stepConfigSchema.optional(),
  condition_type: conditionTypeSchema.optional(),
  condition_config: conditionConfigSchema.optional(),
  next_step_id: z.string().uuid().nullable().optional(),
  condition_yes_step_id: z.string().uuid().nullable().optional(),
  condition_no_step_id: z.string().uuid().nullable().optional()
})

export const reorderStepsSchema = z.object({
  step_ids: z.array(z.string().uuid()).min(1)
})

// ============================================
// ENROLLMENTS
// ============================================

export const enrollContactsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, '少なくとも1件のコンタクトを選択してください')
})

export const updateEnrollmentSchema = z.object({
  status: enrollmentStatusSchema.optional()
})

// ============================================
// SEGMENTS
// ============================================

export const segmentConditionSchema = z.object({
  type: z.enum(['tag', 'custom_field', 'email_activity', 'created_at', 'status']),
  field: z.string().optional(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater', 'less', 'exists', 'not_exists']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
})

export const segmentRulesSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(segmentConditionSchema)
})

export const createSegmentSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255, '名前は255文字以内で入力してください'),
  description: z.string().max(1000).nullable().optional(),
  rules: segmentRulesSchema
})

export const updateSegmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  rules: segmentRulesSchema.optional()
})

// ============================================
// CUSTOM FIELDS
// ============================================

export const createCustomFieldSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255),
  field_key: z.string()
    .min(1, 'フィールドキーは必須です')
    .max(100)
    .regex(/^[a-z_][a-z0-9_]*$/, 'フィールドキーは小文字英字・数字・アンダースコアのみ使用できます'),
  field_type: fieldTypeSchema,
  options: z.array(z.string()).optional(),
  required: z.boolean().optional().default(false)
})

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional()
})

export const setCustomValuesSchema = z.record(z.string().uuid(), z.string().nullable())

// ============================================
// LINE
// ============================================

export const connectLineAccountSchema = z.object({
  channel_id: z.string().min(1, 'Channel IDは必須です'),
  channel_secret: z.string().min(1, 'Channel Secretは必須です'),
  access_token: z.string().min(1, 'Access Tokenは必須です')
})

export const sendLineTestMessageSchema = z.object({
  line_user_id: z.string().min(1, 'LINE User IDは必須です'),
  message: z.string().min(1, 'メッセージは必須です').max(5000)
})

export const createLineLinkSchema = z.object({
  line_account_id: z.string().uuid()
})

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>
export type CreateStepInput = z.infer<typeof createStepSchema>
export type UpdateStepInput = z.infer<typeof updateStepSchema>
export type EnrollContactsInput = z.infer<typeof enrollContactsSchema>
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>
export type ConnectLineAccountInput = z.infer<typeof connectLineAccountSchema>
