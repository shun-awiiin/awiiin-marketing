# Phase 4: セグメント配信

## 実行コマンド
```bash
/l-step phase4
```

## 前提条件
- Phase 1, 2, 3 完了済み

## タスク概要
タグ・属性でターゲットを絞り込むセグメント機能を実装する。

---

## 1. セグメントCRUD API

### app/api/segments/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSegmentSchema } from '@/lib/validation/l-step'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const validation = createSegmentSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      success: false,
      error: validation.error.errors[0].message
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('segments')
    .insert({ ...validation.data, user_id: user.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
```

### app/api/segments/[id]/route.ts
```typescript
// GET: セグメント詳細
// PUT: セグメント更新
// DELETE: セグメント削除
```

### app/api/segments/[id]/contacts/route.ts
```typescript
// GET: セグメントに該当するコンタクト一覧
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateSegment } from '@/lib/segments/segment-evaluator'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { data: segment, error: segmentError } = await supabase
    .from('segments')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (segmentError || !segment) {
    return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
  }

  const contacts = await evaluateSegment(supabase, user.id, segment.rules)

  return NextResponse.json({
    success: true,
    data: contacts,
    meta: { total: contacts.length }
  })
}
```

---

## 2. セグメント評価エンジン

### lib/segments/segment-evaluator.ts
```typescript
import { SegmentRules, SegmentCondition } from '@/lib/types/l-step'

export async function evaluateSegment(
  supabase: any,
  userId: string,
  rules: SegmentRules
): Promise<any[]> {
  const { operator, conditions } = rules

  if (conditions.length === 0) {
    // 条件なし = 全コンタクト
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
    return data || []
  }

  // 各条件のクエリを構築
  const conditionQueries = conditions.map(c => buildConditionQuery(c))

  if (operator === 'AND') {
    return evaluateAnd(supabase, userId, conditionQueries)
  } else {
    return evaluateOr(supabase, userId, conditionQueries)
  }
}

interface ConditionQuery {
  type: string
  table?: string
  column?: string
  operator: string
  value?: any
}

function buildConditionQuery(condition: SegmentCondition): ConditionQuery {
  switch (condition.type) {
    case 'tag':
      return {
        type: 'tag',
        table: 'contact_tags',
        column: 'tag_id',
        operator: condition.operator,
        value: condition.value
      }
    case 'custom_field':
      return {
        type: 'custom_field',
        table: 'contact_custom_values',
        column: 'field_id',
        operator: condition.operator,
        value: condition.value
      }
    case 'email_activity':
      return {
        type: 'email_activity',
        table: 'email_events',
        column: 'event_type',
        operator: condition.operator,
        value: condition.value
      }
    case 'created_at':
      return {
        type: 'created_at',
        column: 'created_at',
        operator: condition.operator,
        value: condition.value
      }
    default:
      return { type: 'unknown', operator: 'equals' }
  }
}

async function evaluateAnd(
  supabase: any,
  userId: string,
  conditions: ConditionQuery[]
): Promise<any[]> {
  // 全条件を満たすコンタクトを取得
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  // タグ条件
  const tagConditions = conditions.filter(c => c.type === 'tag')
  if (tagConditions.length > 0) {
    const tagIds = tagConditions.map(c => c.value)
    // タグを持つコンタクトのIDを取得
    const { data: contactsWithTags } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', tagIds)

    if (!contactsWithTags || contactsWithTags.length === 0) {
      return []
    }

    const contactIds = [...new Set(contactsWithTags.map((c: any) => c.contact_id))]
    query = query.in('id', contactIds)
  }

  // カスタム属性条件
  const customFieldConditions = conditions.filter(c => c.type === 'custom_field')
  for (const condition of customFieldConditions) {
    // カスタム属性を持つコンタクトを取得
    let customQuery = supabase
      .from('contact_custom_values')
      .select('contact_id')
      .eq('field_id', condition.column)

    switch (condition.operator) {
      case 'equals':
        customQuery = customQuery.eq('value', condition.value)
        break
      case 'not_equals':
        customQuery = customQuery.neq('value', condition.value)
        break
      case 'contains':
        customQuery = customQuery.ilike('value', `%${condition.value}%`)
        break
      case 'greater':
        customQuery = customQuery.gt('value', condition.value)
        break
      case 'less':
        customQuery = customQuery.lt('value', condition.value)
        break
    }

    const { data: matchingContacts } = await customQuery

    if (!matchingContacts || matchingContacts.length === 0) {
      return []
    }

    const contactIds = matchingContacts.map((c: any) => c.contact_id)
    query = query.in('id', contactIds)
  }

  // created_at条件
  const dateConditions = conditions.filter(c => c.type === 'created_at')
  for (const condition of dateConditions) {
    switch (condition.operator) {
      case 'greater':
        query = query.gte('created_at', condition.value)
        break
      case 'less':
        query = query.lte('created_at', condition.value)
        break
    }
  }

  const { data } = await query
  return data || []
}

async function evaluateOr(
  supabase: any,
  userId: string,
  conditions: ConditionQuery[]
): Promise<any[]> {
  // いずれかの条件を満たすコンタクトを取得
  const contactIdSets: Set<string>[] = []

  for (const condition of conditions) {
    const ids = await getContactIdsForCondition(supabase, userId, condition)
    contactIdSets.push(new Set(ids))
  }

  // 和集合
  const allIds = new Set<string>()
  for (const idSet of contactIdSets) {
    for (const id of idSet) {
      allIds.add(id)
    }
  }

  if (allIds.size === 0) {
    return []
  }

  const { data } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .in('id', Array.from(allIds))

  return data || []
}

async function getContactIdsForCondition(
  supabase: any,
  userId: string,
  condition: ConditionQuery
): Promise<string[]> {
  switch (condition.type) {
    case 'tag': {
      const { data } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .eq('tag_id', condition.value)
      return data?.map((c: any) => c.contact_id) || []
    }
    case 'custom_field': {
      let query = supabase
        .from('contact_custom_values')
        .select('contact_id')
        .eq('field_id', condition.column)

      // 演算子に応じたフィルタ
      if (condition.operator === 'equals') {
        query = query.eq('value', condition.value)
      }

      const { data } = await query
      return data?.map((c: any) => c.contact_id) || []
    }
    default: {
      const { data } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
      return data?.map((c: any) => c.id) || []
    }
  }
}

export async function countSegmentContacts(
  supabase: any,
  userId: string,
  rules: SegmentRules
): Promise<number> {
  const contacts = await evaluateSegment(supabase, userId, rules)
  return contacts.length
}
```

---

## 3. カスタム属性API

### app/api/custom-fields/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCustomFieldSchema } from '@/lib/validation/l-step'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const validation = createCustomFieldSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      success: false,
      error: validation.error.errors[0].message
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({ ...validation.data, user_id: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({
        success: false,
        error: 'このフィールドキーは既に存在します'
      }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
```

### app/api/contacts/[id]/custom-values/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: コンタクトのカスタム属性値一覧
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contact_custom_values')
    .select(`
      *,
      field:custom_fields(*)
    `)
    .eq('contact_id', params.id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// PUT: カスタム属性値を設定
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const body = await request.json()

  // { field_id: value } の形式で受け取る
  const updates = Object.entries(body).map(([field_id, value]) => ({
    contact_id: params.id,
    field_id,
    value: String(value)
  }))

  const { data, error } = await supabase
    .from('contact_custom_values')
    .upsert(updates, { onConflict: 'contact_id,field_id' })
    .select()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}
```

---

## 4. UI: セグメントビルダー

### app/dashboard/segments/page.tsx
```typescript
import { createClient } from '@/lib/supabase/server'
import { SegmentList } from '@/components/segments/segment-list'

export default async function SegmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: segments } = await supabase
    .from('segments')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">セグメント</h1>
        <a href="/dashboard/segments/new" className="btn btn-primary">
          新規作成
        </a>
      </div>
      <SegmentList segments={segments || []} />
    </div>
  )
}
```

### components/segments/segment-builder.tsx
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import { SegmentRules, SegmentCondition } from '@/lib/types/l-step'

interface SegmentBuilderProps {
  rules: SegmentRules
  onChange: (rules: SegmentRules) => void
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
}

export function SegmentBuilder({ rules, onChange, tags, customFields }: SegmentBuilderProps) {
  const addCondition = () => {
    const newCondition: SegmentCondition = {
      type: 'tag',
      operator: 'equals',
      value: ''
    }
    onChange({
      ...rules,
      conditions: [...rules.conditions, newCondition]
    })
  }

  const updateCondition = (index: number, updates: Partial<SegmentCondition>) => {
    const newConditions = [...rules.conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    onChange({ ...rules, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    const newConditions = rules.conditions.filter((_, i) => i !== index)
    onChange({ ...rules, conditions: newConditions })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">セグメント条件</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label>条件の組み合わせ:</Label>
          <Select
            value={rules.operator}
            onValueChange={(v) => onChange({ ...rules, operator: v as 'AND' | 'OR' })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">すべて満たす</SelectItem>
              <SelectItem value="OR">いずれか満たす</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {rules.conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Select
                value={condition.type}
                onValueChange={(v) => updateCondition(index, { type: v as any })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="条件タイプ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">タグ</SelectItem>
                  <SelectItem value="custom_field">カスタム属性</SelectItem>
                  <SelectItem value="created_at">登録日</SelectItem>
                </SelectContent>
              </Select>

              {condition.type === 'tag' && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as any })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exists">あり</SelectItem>
                      <SelectItem value="not_exists">なし</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(condition.value)}
                    onValueChange={(v) => updateCondition(index, { value: v })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="タグを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {condition.type === 'custom_field' && (
                <>
                  <Select
                    value={condition.field}
                    onValueChange={(v) => updateCondition(index, { field: v })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="属性" />
                    </SelectTrigger>
                    <SelectContent>
                      {customFields.map(field => (
                        <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as any })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">等しい</SelectItem>
                      <SelectItem value="not_equals">等しくない</SelectItem>
                      <SelectItem value="contains">含む</SelectItem>
                      <SelectItem value="greater">より大きい</SelectItem>
                      <SelectItem value="less">より小さい</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="値"
                    value={String(condition.value || '')}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="w-40"
                  />
                </>
              )}

              {condition.type === 'created_at' && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as any })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="greater">以降</SelectItem>
                      <SelectItem value="less">以前</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={String(condition.value || '')}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="w-40"
                  />
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCondition(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-2" />
          条件を追加
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## 5. キャンペーン・シナリオへの統合

### キャンペーン作成時にセグメント選択を追加

app/api/campaigns/route.ts を更新:
```typescript
// POST body に segment_id を追加
const { segment_id, ...campaignData } = body

if (segment_id) {
  // セグメントに該当するコンタクトを配信対象に
  const contacts = await evaluateSegment(supabase, user.id, segment.rules)
  // 配信処理...
}
```

---

## 6. サイドバー更新

### components/dashboard/sidebar.tsx に追加
```typescript
{
  title: 'セグメント',
  icon: Users,
  href: '/dashboard/segments'
}
```

---

## 完了条件

- [ ] セグメントCRUD APIが動作する
- [ ] タグ条件でコンタクトを絞り込める
- [ ] カスタム属性条件で絞り込める
- [ ] AND/OR条件が正しく動作する
- [ ] リアルタイムで該当者数が表示される
- [ ] キャンペーンでセグメントを選択して配信できる
- [ ] カスタム属性の定義・値設定ができる
- [ ] テストカバレッジ80%以上
