# Phase 3: 条件分岐機能

## 実行コマンド
```bash
/l-step phase3
```

## 前提条件
- Phase 1, 2 完了済み

## タスク概要
開封・クリック等の行動に応じてシナリオを分岐させる機能を実装する。

---

## 1. 条件評価エンジン

### lib/scenarios/condition-evaluator.ts
```typescript
import { ConditionType, ConditionConfig, ScenarioEnrollment } from '@/lib/types/l-step'

export interface ConditionResult {
  met: boolean
  timedOut: boolean
}

export async function evaluateCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  conditionType: ConditionType,
  config: ConditionConfig
): Promise<ConditionResult> {
  switch (conditionType) {
    case 'opened':
      return evaluateOpenedCondition(supabase, enrollment, config)
    case 'clicked':
      return evaluateClickedCondition(supabase, enrollment, config)
    case 'not_opened':
      return evaluateNotOpenedCondition(supabase, enrollment, config)
    case 'not_clicked':
      return evaluateNotClickedCondition(supabase, enrollment, config)
    case 'has_tag':
      return evaluateHasTagCondition(supabase, enrollment, config)
    case 'custom_field':
      return evaluateCustomFieldCondition(supabase, enrollment, config)
    default:
      return { met: false, timedOut: false }
  }
}

async function evaluateOpenedCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  // 対象メールの開封イベントを確認
  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id)
    .eq('event_type', 'opened')
    .limit(1)

  if (events && events.length > 0) {
    return { met: true, timedOut: false }
  }

  // タイムアウトチェック
  const timedOut = checkTimeout(enrollment, config)
  return { met: false, timedOut }
}

async function evaluateClickedCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id)
    .eq('event_type', 'clicked')
    .limit(1)

  if (events && events.length > 0) {
    return { met: true, timedOut: false }
  }

  const timedOut = checkTimeout(enrollment, config)
  return { met: false, timedOut }
}

async function evaluateNotOpenedCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  // タイムアウトまで待って、開封されていなければ条件成立
  const timedOut = checkTimeout(enrollment, config)

  if (!timedOut) {
    return { met: false, timedOut: false }
  }

  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id)
    .eq('event_type', 'opened')
    .limit(1)

  return { met: !events || events.length === 0, timedOut: true }
}

async function evaluateNotClickedCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const timedOut = checkTimeout(enrollment, config)

  if (!timedOut) {
    return { met: false, timedOut: false }
  }

  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id)
    .eq('event_type', 'clicked')
    .limit(1)

  return { met: !events || events.length === 0, timedOut: true }
}

async function evaluateHasTagCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: contactTags } = await supabase
    .from('contact_tags')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('tag_id', config.tag_id)
    .limit(1)

  return { met: contactTags && contactTags.length > 0, timedOut: false }
}

async function evaluateCustomFieldCondition(
  supabase: any,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: customValue } = await supabase
    .from('contact_custom_values')
    .select('value')
    .eq('contact_id', enrollment.contact_id)
    .eq('field_id', config.field_id)
    .single()

  if (!customValue) {
    return { met: false, timedOut: false }
  }

  const value = customValue.value
  const targetValue = config.field_value

  let met = false
  switch (config.field_operator) {
    case 'equals':
      met = value === targetValue
      break
    case 'not_equals':
      met = value !== targetValue
      break
    case 'contains':
      met = value?.includes(targetValue || '') || false
      break
    case 'greater':
      met = Number(value) > Number(targetValue)
      break
    case 'less':
      met = Number(value) < Number(targetValue)
      break
  }

  return { met, timedOut: false }
}

function checkTimeout(
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): boolean {
  if (!config.timeout_value || !config.timeout_unit) {
    return false
  }

  const enrolledAt = new Date(enrollment.enrolled_at)
  const now = new Date()

  let timeoutMs = config.timeout_value
  switch (config.timeout_unit) {
    case 'minutes':
      timeoutMs *= 60 * 1000
      break
    case 'hours':
      timeoutMs *= 60 * 60 * 1000
      break
    case 'days':
      timeoutMs *= 24 * 60 * 60 * 1000
      break
  }

  return now.getTime() - enrolledAt.getTime() >= timeoutMs
}
```

---

## 2. シナリオプロセッサー更新

### lib/scenarios/scenario-processor.ts に追加
```typescript
import { evaluateCondition } from './condition-evaluator'

// processEnrollment 内の case 'condition' を実装
case 'condition':
  await executeConditionStep(supabase, enrollment, step)
  break

async function executeConditionStep(
  supabase: any,
  enrollment: any,
  step: ScenarioStep
) {
  const result = await evaluateCondition(
    supabase,
    enrollment,
    step.condition_type!,
    step.condition_config!
  )

  if (result.met) {
    // Yes パスへ
    await supabase
      .from('scenario_enrollments')
      .update({
        current_step_id: step.condition_yes_step_id,
        next_action_at: new Date().toISOString()
      })
      .eq('id', enrollment.id)
  } else if (result.timedOut) {
    // No パスへ（タイムアウト）
    await supabase
      .from('scenario_enrollments')
      .update({
        current_step_id: step.condition_no_step_id,
        next_action_at: new Date().toISOString()
      })
      .eq('id', enrollment.id)
  }
  // タイムアウトしていない場合は次のCronで再チェック
}
```

---

## 3. Webhook連携

### app/api/webhooks/email/route.ts 更新
```typescript
// 既存のWebhook処理に追加

async function handleEmailEvent(event: EmailEvent) {
  // 既存の処理...

  // シナリオ条件チェックをトリガー
  if (event.type === 'opened' || event.type === 'clicked') {
    await triggerConditionCheck(event.contact_id)
  }
}

async function triggerConditionCheck(contactId: string) {
  const supabase = await createClient()

  // このコンタクトのアクティブな登録で条件待ちのものを即時処理
  const { data: enrollments } = await supabase
    .from('scenario_enrollments')
    .select(`
      *,
      current_step:scenario_steps(*)
    `)
    .eq('contact_id', contactId)
    .eq('status', 'active')

  for (const enrollment of enrollments || []) {
    if (enrollment.current_step?.step_type === 'condition') {
      // next_action_atを現在時刻に更新して即時処理を促す
      await supabase
        .from('scenario_enrollments')
        .update({ next_action_at: new Date().toISOString() })
        .eq('id', enrollment.id)
    }
  }
}
```

---

## 4. UI: 条件分岐ノード

### components/scenarios/condition-node.tsx
```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConditionType, ConditionConfig } from '@/lib/types/l-step'

interface ConditionNodeProps {
  conditionType: ConditionType | null
  config: ConditionConfig | null
  onChange: (type: ConditionType, config: ConditionConfig) => void
}

export function ConditionNode({ conditionType, config, onChange }: ConditionNodeProps) {
  const [type, setType] = useState<ConditionType | null>(conditionType)
  const [localConfig, setLocalConfig] = useState<ConditionConfig>(config || {})

  const handleTypeChange = (newType: ConditionType) => {
    setType(newType)
    onChange(newType, localConfig)
  }

  const handleConfigChange = (key: keyof ConditionConfig, value: any) => {
    const newConfig = { ...localConfig, [key]: value }
    setLocalConfig(newConfig)
    if (type) {
      onChange(type, newConfig)
    }
  }

  return (
    <Card className="border-yellow-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">条件分岐</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>条件タイプ</Label>
          <Select value={type || ''} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="条件を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opened">メール開封</SelectItem>
              <SelectItem value="clicked">リンククリック</SelectItem>
              <SelectItem value="not_opened">メール未開封</SelectItem>
              <SelectItem value="not_clicked">リンク未クリック</SelectItem>
              <SelectItem value="has_tag">タグあり</SelectItem>
              <SelectItem value="custom_field">カスタム属性</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(type === 'opened' || type === 'clicked' || type === 'not_opened' || type === 'not_clicked') && (
          <div>
            <Label>対象メール</Label>
            {/* メール選択UI */}
          </div>
        )}

        {(type === 'not_opened' || type === 'not_clicked') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>タイムアウト</Label>
              <Input
                type="number"
                value={localConfig.timeout_value || ''}
                onChange={(e) => handleConfigChange('timeout_value', Number(e.target.value))}
              />
            </div>
            <div>
              <Label>単位</Label>
              <Select
                value={localConfig.timeout_unit || 'hours'}
                onValueChange={(v) => handleConfigChange('timeout_unit', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">分</SelectItem>
                  <SelectItem value="hours">時間</SelectItem>
                  <SelectItem value="days">日</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-green-600">Yes →</span>
          <span className="text-red-600">No →</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

### components/scenarios/flow-canvas.tsx
```typescript
'use client'

import { useState } from 'react'
import { ScenarioStep } from '@/lib/types/l-step'
import { StepNode } from './step-node'
import { ConditionNode } from './condition-node'

interface FlowCanvasProps {
  steps: ScenarioStep[]
  onStepsChange: (steps: ScenarioStep[]) => void
}

export function FlowCanvas({ steps, onStepsChange }: FlowCanvasProps) {
  const renderStep = (step: ScenarioStep, index: number) => {
    if (step.step_type === 'condition') {
      return (
        <div key={step.id} className="flex flex-col items-center">
          <ConditionNode
            conditionType={step.condition_type}
            config={step.condition_config}
            onChange={(type, config) => {
              const newSteps = [...steps]
              newSteps[index] = {
                ...step,
                condition_type: type,
                condition_config: config
              }
              onStepsChange(newSteps)
            }}
          />
          <div className="flex gap-8 mt-4">
            <div className="flex flex-col items-center">
              <span className="text-green-600 text-xs mb-2">Yes</span>
              {/* Yes パスのステップ */}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-red-600 text-xs mb-2">No</span>
              {/* No パスのステップ */}
            </div>
          </div>
        </div>
      )
    }

    return (
      <StepNode
        key={step.id}
        step={step}
        onChange={(updated) => {
          const newSteps = [...steps]
          newSteps[index] = updated
          onStepsChange(newSteps)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      {steps.map((step, index) => (
        <div key={step.id}>
          {renderStep(step, index)}
          {index < steps.length - 1 && (
            <div className="h-8 w-px bg-gray-300 mx-auto" />
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## 5. テスト

### lib/scenarios/__tests__/condition-evaluator.test.ts
```typescript
import { describe, it, expect, vi } from 'vitest'
import { evaluateCondition } from '../condition-evaluator'

describe('evaluateCondition', () => {
  const mockSupabase = {
    from: vi.fn()
  }

  describe('opened condition', () => {
    it('returns met=true when email was opened', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: '1', event_type: 'opened' }]
                })
              })
            })
          })
        })
      })

      const result = await evaluateCondition(
        mockSupabase,
        { contact_id: 'contact-1' } as any,
        'opened',
        { email_id: 'email-1' }
      )

      expect(result.met).toBe(true)
      expect(result.timedOut).toBe(false)
    })

    it('returns met=false when email was not opened', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: []
                })
              })
            })
          })
        })
      })

      const result = await evaluateCondition(
        mockSupabase,
        { contact_id: 'contact-1', enrolled_at: new Date().toISOString() } as any,
        'opened',
        { email_id: 'email-1' }
      )

      expect(result.met).toBe(false)
    })
  })

  describe('has_tag condition', () => {
    it('returns met=true when contact has tag', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: '1' }]
              })
            })
          })
        })
      })

      const result = await evaluateCondition(
        mockSupabase,
        { contact_id: 'contact-1' } as any,
        'has_tag',
        { tag_id: 'tag-1' }
      )

      expect(result.met).toBe(true)
    })
  })
})
```

---

## 完了条件

- [ ] 条件評価エンジンが全条件タイプに対応
- [ ] 開封/クリック時にシナリオが自動分岐
- [ ] タイムアウト時にNoパスへ進む
- [ ] WebhookでリアルタイムにConditionがトリガーされる
- [ ] UIで条件分岐ノードを設定できる
- [ ] 条件評価のテストカバレッジ80%以上
