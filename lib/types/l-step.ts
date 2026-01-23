// L-Step Feature Types
// Scenario-based email/LINE delivery, segments, custom fields

// ============================================
// ENUMS
// ============================================

export type ScenarioStatus = 'draft' | 'active' | 'paused' | 'archived'
export type StepType = 'email' | 'wait' | 'condition' | 'line' | 'action'
export type TriggerType = 'signup' | 'tag_added' | 'tag_removed' | 'form_submit' | 'manual'
export type ConditionType = 'opened' | 'clicked' | 'not_opened' | 'not_clicked' | 'has_tag' | 'custom_field'
export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'exited'
export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select'
export type LineMessageStatus = 'pending' | 'sent' | 'delivered' | 'failed'

// ============================================
// SCENARIOS
// ============================================

export interface Scenario {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ScenarioStatus
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  created_at: string
  updated_at: string
}

export interface TriggerConfig {
  tag_id?: string
  form_id?: string
  [key: string]: unknown
}

export interface ScenarioStep {
  id: string
  scenario_id: string
  step_order: number
  step_type: StepType
  name: string | null
  config: StepConfig
  condition_type: ConditionType | null
  condition_config: ConditionConfig | null
  next_step_id: string | null
  condition_yes_step_id: string | null
  condition_no_step_id: string | null
  created_at: string
  updated_at: string
}

export interface StepConfig {
  // Email step
  template_id?: string
  subject?: string
  content?: string
  from_name?: string
  from_email?: string
  // Wait step
  wait_value?: number
  wait_unit?: 'minutes' | 'hours' | 'days'
  // LINE step
  line_message_type?: 'text' | 'flex' | 'template'
  line_content?: LineContent
  // Action step
  action_type?: 'add_tag' | 'remove_tag' | 'update_field'
  action_config?: Record<string, unknown>
}

export interface LineContent {
  text?: string
  altText?: string
  contents?: Record<string, unknown>
}

export interface ConditionConfig {
  timeout_value?: number
  timeout_unit?: 'minutes' | 'hours' | 'days'
  email_id?: string
  step_id?: string
  tag_id?: string
  field_id?: string
  field_operator?: 'equals' | 'not_equals' | 'contains' | 'greater' | 'less'
  field_value?: string
}

export interface ScenarioEnrollment {
  id: string
  scenario_id: string
  contact_id: string
  current_step_id: string | null
  status: EnrollmentStatus
  enrolled_at: string
  next_action_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown>
}

export interface ScenarioWithSteps extends Scenario {
  scenario_steps: ScenarioStep[]
}

export interface EnrollmentWithDetails extends ScenarioEnrollment {
  scenario?: Scenario
  current_step?: ScenarioStep
  contact?: {
    id: string
    email: string
    first_name?: string
  }
}

// ============================================
// SEGMENTS
// ============================================

export interface Segment {
  id: string
  user_id: string
  name: string
  description: string | null
  rules: SegmentRules
  contact_count: number
  created_at: string
  updated_at: string
}

export interface SegmentRules {
  operator: 'AND' | 'OR'
  conditions: SegmentCondition[]
}

export interface SegmentCondition {
  type: 'tag' | 'custom_field' | 'email_activity' | 'created_at' | 'status'
  field?: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater' | 'less' | 'exists' | 'not_exists'
  value?: string | number | boolean
}

// ============================================
// CUSTOM FIELDS
// ============================================

export interface CustomField {
  id: string
  user_id: string
  name: string
  field_key: string
  field_type: FieldType
  options: string[] | null
  required: boolean
  created_at: string
}

export interface ContactCustomValue {
  id: string
  contact_id: string
  field_id: string
  value: string | null
  created_at: string
  updated_at: string
}

export interface ContactCustomValueWithField extends ContactCustomValue {
  field: CustomField
}

// ============================================
// LINE
// ============================================

export interface LineAccount {
  id: string
  user_id: string
  channel_id: string
  channel_secret: string
  access_token: string
  bot_basic_id: string | null
  display_name: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface LineAccountPublic {
  id: string
  channel_id: string
  bot_basic_id: string | null
  display_name: string | null
  status: string
  created_at: string
}

export interface ContactLineLink {
  id: string
  contact_id: string
  line_user_id: string
  line_account_id: string
  display_name: string | null
  picture_url: string | null
  status: string
  linked_at: string
}

export interface LineMessage {
  id: string
  line_account_id: string
  contact_id: string | null
  line_user_id: string
  message_type: string
  content: Record<string, unknown>
  status: LineMessageStatus
  sent_at: string | null
  error_message: string | null
  created_at: string
}

export interface LinkToken {
  id: string
  token: string
  contact_id: string
  line_account_id: string
  expires_at: string
  used_at: string | null
  created_at: string
}

// ============================================
// EMAIL EVENTS
// ============================================

export interface EmailEvent {
  id: string
  contact_id: string
  message_id: string | null
  email_id: string | null
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}

// ============================================
// SCENARIO LOGS
// ============================================

export interface ScenarioLog {
  id: string
  scenario_id: string | null
  enrollment_id: string | null
  step_id: string | null
  level: 'info' | 'warn' | 'error'
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

// ============================================
// API TYPES
// ============================================

export interface CreateScenarioInput {
  name: string
  description?: string
  trigger_type?: TriggerType
  trigger_config?: TriggerConfig
}

export interface UpdateScenarioInput {
  name?: string
  description?: string
  status?: ScenarioStatus
  trigger_type?: TriggerType
  trigger_config?: TriggerConfig
}

export interface CreateStepInput {
  step_type: StepType
  name?: string
  config?: StepConfig
  condition_type?: ConditionType
  condition_config?: ConditionConfig
}

export interface UpdateStepInput {
  name?: string
  config?: StepConfig
  condition_type?: ConditionType
  condition_config?: ConditionConfig
  next_step_id?: string | null
  condition_yes_step_id?: string | null
  condition_no_step_id?: string | null
}

export interface CreateSegmentInput {
  name: string
  description?: string
  rules: SegmentRules
}

export interface CreateCustomFieldInput {
  name: string
  field_key: string
  field_type: FieldType
  options?: string[]
  required?: boolean
}

export interface ConnectLineAccountInput {
  channel_id: string
  channel_secret: string
  access_token: string
}

export interface EnrollContactsInput {
  contact_ids: string[]
}

// ============================================
// SCENARIO PROCESSING
// ============================================

export interface ProcessingResult {
  processed: number
  errors: string[]
  skipped?: boolean
}

export interface ConditionResult {
  met: boolean
  timedOut: boolean
}
