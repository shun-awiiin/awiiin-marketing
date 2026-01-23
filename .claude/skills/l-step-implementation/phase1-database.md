# Phase 1: データベース基盤

## 実行コマンド
```bash
/l-step phase1
```

## タスク概要
Lステップ機能のデータベーススキーマを作成する。

## 作成するマイグレーション

### 1. ENUMs定義
ファイル: `supabase/migrations/YYYYMMDD000000_l_step_enums.sql`

```sql
-- シナリオステータス
CREATE TYPE scenario_status AS ENUM ('draft', 'active', 'paused', 'archived');

-- ステップタイプ
CREATE TYPE step_type AS ENUM ('email', 'wait', 'condition', 'line', 'action');

-- トリガータイプ
CREATE TYPE trigger_type AS ENUM ('signup', 'tag_added', 'tag_removed', 'form_submit', 'manual');

-- 条件タイプ
CREATE TYPE condition_type AS ENUM ('opened', 'clicked', 'not_opened', 'not_clicked', 'has_tag', 'custom_field');

-- 登録ステータス
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'paused', 'exited');

-- カスタムフィールドタイプ
CREATE TYPE field_type AS ENUM ('text', 'number', 'date', 'boolean', 'select');

-- LINEメッセージステータス
CREATE TYPE line_message_status AS ENUM ('pending', 'sent', 'delivered', 'failed');
```

### 2. scenariosテーブル
```sql
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status scenario_status NOT NULL DEFAULT 'draft',
  trigger_type trigger_type NOT NULL DEFAULT 'manual',
  trigger_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX idx_scenarios_status ON scenarios(status);

-- RLS
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own scenarios" ON scenarios
  FOR ALL USING (auth.uid() = user_id);
```

### 3. scenario_stepsテーブル
```sql
CREATE TABLE scenario_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type step_type NOT NULL,
  name VARCHAR(255),
  config JSONB NOT NULL DEFAULT '{}',
  -- 条件分岐用
  condition_type condition_type,
  condition_config JSONB,
  next_step_id UUID REFERENCES scenario_steps(id),
  condition_yes_step_id UUID REFERENCES scenario_steps(id),
  condition_no_step_id UUID REFERENCES scenario_steps(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scenario_id, step_order)
);

CREATE INDEX idx_scenario_steps_scenario_id ON scenario_steps(scenario_id);
```

### 4. scenario_enrollmentsテーブル
```sql
CREATE TABLE scenario_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES scenario_steps(id),
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_action_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(scenario_id, contact_id)
);

CREATE INDEX idx_enrollments_next_action ON scenario_enrollments(next_action_at)
  WHERE status = 'active';
CREATE INDEX idx_enrollments_contact ON scenario_enrollments(contact_id);
```

### 5. segmentsテーブル
```sql
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{"operator": "AND", "conditions": []}',
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_user_id ON segments(user_id);

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own segments" ON segments
  FOR ALL USING (auth.uid() = user_id);
```

### 6. custom_fieldsテーブル
```sql
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  options JSONB,
  required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, field_key)
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own custom_fields" ON custom_fields
  FOR ALL USING (auth.uid() = user_id);
```

### 7. contact_custom_valuesテーブル
```sql
CREATE TABLE contact_custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, field_id)
);

CREATE INDEX idx_custom_values_contact ON contact_custom_values(contact_id);
```

### 8. line_accountsテーブル
```sql
CREATE TABLE line_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id VARCHAR(255) NOT NULL,
  channel_secret VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  bot_basic_id VARCHAR(100),
  display_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE line_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own line_accounts" ON line_accounts
  FOR ALL USING (auth.uid() = user_id);
```

### 9. contact_line_linksテーブル
```sql
CREATE TABLE contact_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  line_user_id VARCHAR(255) NOT NULL,
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  picture_url TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, line_account_id),
  UNIQUE(line_user_id, line_account_id)
);

CREATE INDEX idx_line_links_line_user ON contact_line_links(line_user_id);
```

### 10. line_messagesテーブル
```sql
CREATE TABLE line_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  line_user_id VARCHAR(255) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  status line_message_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_messages_contact ON line_messages(contact_id);
CREATE INDEX idx_line_messages_status ON line_messages(status);
```

## 型定義ファイル

ファイル: `lib/types/l-step.ts`

```typescript
// Enums
export type ScenarioStatus = 'draft' | 'active' | 'paused' | 'archived'
export type StepType = 'email' | 'wait' | 'condition' | 'line' | 'action'
export type TriggerType = 'signup' | 'tag_added' | 'tag_removed' | 'form_submit' | 'manual'
export type ConditionType = 'opened' | 'clicked' | 'not_opened' | 'not_clicked' | 'has_tag' | 'custom_field'
export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'exited'
export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select'
export type LineMessageStatus = 'pending' | 'sent' | 'delivered' | 'failed'

// Scenarios
export interface Scenario {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ScenarioStatus
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  created_at: string
  updated_at: string
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
  // Wait step
  wait_value?: number
  wait_unit?: 'minutes' | 'hours' | 'days'
  // LINE step
  line_message_type?: 'text' | 'flex' | 'template'
  line_content?: Record<string, unknown>
}

export interface ConditionConfig {
  timeout_value?: number
  timeout_unit?: 'minutes' | 'hours' | 'days'
  email_id?: string
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

// Segments
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
  type: 'tag' | 'custom_field' | 'email_activity' | 'created_at'
  field?: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater' | 'less' | 'exists' | 'not_exists'
  value?: string | number | boolean
}

// Custom Fields
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

// LINE
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

export interface ContactLineLink {
  id: string
  contact_id: string
  line_user_id: string
  line_account_id: string
  display_name: string | null
  picture_url: string | null
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
```

## Zodスキーマ

ファイル: `lib/validation/l-step.ts`

```typescript
import { z } from 'zod'

export const scenarioStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export const stepTypeSchema = z.enum(['email', 'wait', 'condition', 'line', 'action'])
export const triggerTypeSchema = z.enum(['signup', 'tag_added', 'tag_removed', 'form_submit', 'manual'])

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  trigger_type: triggerTypeSchema.optional().default('manual'),
  trigger_config: z.record(z.unknown()).optional().default({})
})

export const createStepSchema = z.object({
  step_type: stepTypeSchema,
  name: z.string().max(255).optional(),
  config: z.record(z.unknown()).default({})
})

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  rules: z.object({
    operator: z.enum(['AND', 'OR']),
    conditions: z.array(z.object({
      type: z.enum(['tag', 'custom_field', 'email_activity', 'created_at']),
      field: z.string().optional(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'greater', 'less', 'exists', 'not_exists']),
      value: z.union([z.string(), z.number(), z.boolean()]).optional()
    }))
  })
})

export const createCustomFieldSchema = z.object({
  name: z.string().min(1).max(255),
  field_key: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional().default(false)
})

export const connectLineAccountSchema = z.object({
  channel_id: z.string().min(1),
  channel_secret: z.string().min(1),
  access_token: z.string().min(1)
})
```

## 完了条件

- [ ] マイグレーションファイルが作成されている
- [ ] `npx supabase db push` または `npx supabase migration up` が成功
- [ ] lib/types/l-step.ts が作成されている
- [ ] lib/validation/l-step.ts が作成されている
- [ ] TypeScriptビルドが通る
