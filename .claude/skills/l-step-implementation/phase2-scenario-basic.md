# Phase 2: シナリオ基本機能

## 実行コマンド
```bash
/l-step phase2
```

## 前提条件
- Phase 1 完了済み

## タスク概要
シナリオ配信（ステップメール）の基本機能を実装する。

---

## 1. シナリオCRUD API

### app/api/scenarios/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScenarioSchema } from '@/lib/validation/l-step'

// GET: シナリオ一覧取得
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('scenarios')
    .select('*, scenario_steps(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// POST: シナリオ作成
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const validation = createScenarioSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      success: false,
      error: validation.error.errors[0].message
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scenarios')
    .insert({ ...validation.data, user_id: user.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
```

### app/api/scenarios/[id]/route.ts
```typescript
// GET: シナリオ詳細
// PUT: シナリオ更新
// DELETE: シナリオ削除
```

---

## 2. ステップ管理API

### app/api/scenarios/[id]/steps/route.ts
```typescript
// GET: ステップ一覧
// POST: ステップ追加
// PUT: ステップ並び替え
```

### app/api/scenarios/[id]/steps/[stepId]/route.ts
```typescript
// PUT: ステップ更新
// DELETE: ステップ削除
```

---

## 3. シナリオ登録API

### app/api/scenarios/[id]/enroll/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: コンタクトをシナリオに登録
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { contact_ids } = await request.json()
  const scenarioId = params.id

  // シナリオの最初のステップを取得
  const { data: firstStep } = await supabase
    .from('scenario_steps')
    .select('id')
    .eq('scenario_id', scenarioId)
    .order('step_order', { ascending: true })
    .limit(1)
    .single()

  if (!firstStep) {
    return NextResponse.json({
      success: false,
      error: 'シナリオにステップがありません'
    }, { status: 400 })
  }

  // 登録データ作成
  const enrollments = contact_ids.map((contact_id: string) => ({
    scenario_id: scenarioId,
    contact_id,
    current_step_id: firstStep.id,
    status: 'active',
    next_action_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('scenario_enrollments')
    .upsert(enrollments, { onConflict: 'scenario_id,contact_id' })
    .select()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data, enrolled: data?.length || 0 })
}
```

---

## 4. シナリオ処理エンジン

### lib/scenarios/scenario-processor.ts
```typescript
import { createClient } from '@/lib/supabase/server'
import { ScenarioEnrollment, ScenarioStep } from '@/lib/types/l-step'
import { executeEmailStep } from './step-executors/email-step'
import { executeWaitStep } from './step-executors/wait-step'

export async function processScenarios() {
  const supabase = await createClient()

  // 実行すべき登録を取得
  const { data: enrollments, error } = await supabase
    .from('scenario_enrollments')
    .select(`
      *,
      scenario:scenarios(*),
      current_step:scenario_steps(*)
    `)
    .eq('status', 'active')
    .lte('next_action_at', new Date().toISOString())
    .limit(100)

  if (error || !enrollments) {
    console.error('Failed to fetch enrollments:', error)
    return { processed: 0, errors: [] }
  }

  const results = {
    processed: 0,
    errors: [] as string[]
  }

  for (const enrollment of enrollments) {
    try {
      await processEnrollment(supabase, enrollment)
      results.processed++
    } catch (err) {
      results.errors.push(`Enrollment ${enrollment.id}: ${err}`)
    }
  }

  return results
}

async function processEnrollment(
  supabase: ReturnType<typeof createClient>,
  enrollment: ScenarioEnrollment & {
    scenario: any
    current_step: ScenarioStep
  }
) {
  const step = enrollment.current_step

  if (!step) {
    // ステップがない = 完了
    await supabase
      .from('scenario_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', enrollment.id)
    return
  }

  // ステップタイプに応じた処理
  switch (step.step_type) {
    case 'email':
      await executeEmailStep(supabase, enrollment, step)
      break
    case 'wait':
      await executeWaitStep(supabase, enrollment, step)
      break
    case 'condition':
      // Phase 3で実装
      break
    case 'line':
      // Phase 5で実装
      break
  }

  // 次のステップへ進む
  await moveToNextStep(supabase, enrollment, step)
}

async function moveToNextStep(
  supabase: any,
  enrollment: ScenarioEnrollment,
  currentStep: ScenarioStep
) {
  const nextStepId = currentStep.next_step_id

  if (!nextStepId) {
    // 次のステップがない = 完了
    await supabase
      .from('scenario_enrollments')
      .update({
        status: 'completed',
        current_step_id: null,
        completed_at: new Date().toISOString()
      })
      .eq('id', enrollment.id)
    return
  }

  // 次のステップの情報を取得して next_action_at を計算
  const { data: nextStep } = await supabase
    .from('scenario_steps')
    .select('*')
    .eq('id', nextStepId)
    .single()

  let nextActionAt = new Date()

  if (nextStep?.step_type === 'wait') {
    const config = nextStep.config
    const value = config.wait_value || 1
    const unit = config.wait_unit || 'days'

    switch (unit) {
      case 'minutes':
        nextActionAt.setMinutes(nextActionAt.getMinutes() + value)
        break
      case 'hours':
        nextActionAt.setHours(nextActionAt.getHours() + value)
        break
      case 'days':
        nextActionAt.setDate(nextActionAt.getDate() + value)
        break
    }
  }

  await supabase
    .from('scenario_enrollments')
    .update({
      current_step_id: nextStepId,
      next_action_at: nextActionAt.toISOString()
    })
    .eq('id', enrollment.id)
}
```

### lib/scenarios/step-executors/email-step.ts
```typescript
import { sendEmail } from '@/lib/email/send'

export async function executeEmailStep(
  supabase: any,
  enrollment: any,
  step: any
) {
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', enrollment.contact_id)
    .single()

  if (!contact?.email) {
    throw new Error('Contact has no email')
  }

  const config = step.config

  await sendEmail({
    to: contact.email,
    subject: config.subject || 'No Subject',
    html: config.content || '',
    // テンプレート変数展開
    variables: {
      name: contact.name || '',
      email: contact.email
    }
  })
}
```

### lib/scenarios/step-executors/wait-step.ts
```typescript
export async function executeWaitStep(
  supabase: any,
  enrollment: any,
  step: any
) {
  // 待機ステップは next_action_at の更新のみ
  // 実際の待機は moveToNextStep で処理される
  return
}
```

---

## 5. Cronジョブエンドポイント

### app/api/cron/scenario-processor/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { processScenarios } from '@/lib/scenarios/scenario-processor'

export async function POST(request: NextRequest) {
  // Cron認証（Vercel Cron等）
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processScenarios()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Scenario processing failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Processing failed'
    }, { status: 500 })
  }
}
```

### vercel.json (Cron設定)
```json
{
  "crons": [
    {
      "path": "/api/cron/scenario-processor",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## 6. UI実装

### app/dashboard/scenarios/page.tsx
- シナリオ一覧表示
- 新規作成ボタン
- ステータスフィルター
- 統計表示（登録者数、完了数）

### app/dashboard/scenarios/new/page.tsx
- シナリオ基本情報入力
- トリガー設定

### app/dashboard/scenarios/[id]/page.tsx
- シナリオ詳細・編集
- ステップ一覧・編集
- 登録者一覧

### components/scenarios/scenario-builder.tsx
- ステップのドラッグ&ドロップ
- ステップ種類選択
- ステップ設定モーダル

### components/scenarios/step-editor.tsx
- メールステップ: 件名・本文編集
- 待機ステップ: 時間設定

---

## 7. サイドバー更新

### components/dashboard/sidebar.tsx に追加
```typescript
{
  title: 'シナリオ',
  icon: GitBranch,
  href: '/dashboard/scenarios'
}
```

---

## 完了条件

- [ ] シナリオCRUD APIが動作する
- [ ] ステップ追加・編集・削除ができる
- [ ] コンタクトをシナリオに登録できる
- [ ] Cronジョブでシナリオが処理される
- [ ] メールステップでメールが送信される
- [ ] 待機ステップで指定時間後に次へ進む
- [ ] UIでシナリオを作成・編集できる
- [ ] 単体テストのカバレッジ80%以上
