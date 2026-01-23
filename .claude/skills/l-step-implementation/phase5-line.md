# Phase 5: LINE連携

## 実行コマンド
```bash
/l-step phase5
```

## 前提条件
- Phase 1-4 完了済み
- LINE Developersアカウント
- LINE公式アカウント（Messaging API有効）

## タスク概要
LINE公式アカウントと連携し、LINEメッセージを送信できるようにする。

---

## 1. LINE Messaging APIクライアント

### lib/line/line-client.ts
```typescript
import crypto from 'crypto'

const LINE_API_BASE = 'https://api.line.me/v2/bot'

export interface LineMessage {
  type: 'text' | 'flex' | 'template'
  text?: string
  altText?: string
  contents?: Record<string, unknown>
  template?: Record<string, unknown>
}

export class LineClient {
  private accessToken: string
  private channelSecret: string

  constructor(accessToken: string, channelSecret: string) {
    this.accessToken = accessToken
    this.channelSecret = channelSecret
  }

  // 署名検証
  verifySignature(body: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.channelSecret)
      .update(body)
      .digest('base64')
    return hash === signature
  }

  // プッシュメッセージ送信
  async pushMessage(to: string, messages: LineMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ to, messages })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`LINE API Error: ${error.message || response.statusText}`)
    }
  }

  // マルチキャスト（複数ユーザーに送信）
  async multicast(to: string[], messages: LineMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/multicast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ to, messages })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`LINE API Error: ${error.message || response.statusText}`)
    }
  }

  // ユーザープロフィール取得
  async getProfile(userId: string): Promise<{
    displayName: string
    userId: string
    pictureUrl?: string
    statusMessage?: string
  }> {
    const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.statusText}`)
    }

    return response.json()
  }

  // リッチメニュー設定
  async setRichMenu(userId: string, richMenuId: string): Promise<void> {
    const response = await fetch(
      `${LINE_API_BASE}/user/${userId}/richmenu/${richMenuId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to set rich menu: ${response.statusText}`)
    }
  }
}

// Flexメッセージビルダー
export function buildFlexMessage(
  altText: string,
  contents: Record<string, unknown>
): LineMessage {
  return {
    type: 'flex',
    altText,
    contents
  }
}

// テキストメッセージビルダー
export function buildTextMessage(text: string): LineMessage {
  return {
    type: 'text',
    text
  }
}
```

---

## 2. LINE連携設定API

### app/api/line/accounts/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectLineAccountSchema } from '@/lib/validation/l-step'
import { LineClient } from '@/lib/line/line-client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('line_accounts')
    .select('id, channel_id, bot_basic_id, display_name, status, created_at')
    .eq('user_id', user.id)

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
  const validation = connectLineAccountSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      success: false,
      error: validation.error.errors[0].message
    }, { status: 400 })
  }

  // 接続テスト
  try {
    const client = new LineClient(validation.data.access_token, validation.data.channel_secret)
    // Bot情報取得でテスト
    const botInfo = await fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': `Bearer ${validation.data.access_token}` }
    }).then(r => r.json())

    const { data, error } = await supabase
      .from('line_accounts')
      .insert({
        user_id: user.id,
        channel_id: validation.data.channel_id,
        channel_secret: validation.data.channel_secret,
        access_token: validation.data.access_token,
        bot_basic_id: botInfo.basicId,
        display_name: botInfo.displayName,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: 'LINE APIへの接続に失敗しました。認証情報を確認してください。'
    }, { status: 400 })
  }
}
```

### app/api/line/accounts/[id]/route.ts
```typescript
// GET: アカウント詳細
// PUT: アカウント更新
// DELETE: アカウント削除（連携解除）
```

### app/api/line/accounts/[id]/test/route.ts
```typescript
// POST: テストメッセージ送信
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LineClient, buildTextMessage } from '@/lib/line/line-client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { line_user_id, message } = await request.json()

  const { data: account } = await supabase
    .from('line_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!account) {
    return NextResponse.json({ success: false, error: 'アカウントが見つかりません' }, { status: 404 })
  }

  try {
    const client = new LineClient(account.access_token, account.channel_secret)
    await client.pushMessage(line_user_id, [buildTextMessage(message)])

    return NextResponse.json({ success: true, message: '送信しました' })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: `送信に失敗しました: ${err}`
    }, { status: 500 })
  }
}
```

---

## 3. LINE Webhookエンドポイント

### app/api/webhooks/line/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LineClient } from '@/lib/line/line-client'

interface LineWebhookEvent {
  type: 'follow' | 'unfollow' | 'message' | 'postback'
  source: {
    type: 'user' | 'group' | 'room'
    userId?: string
    groupId?: string
    roomId?: string
  }
  timestamp: number
  message?: {
    type: string
    id: string
    text?: string
  }
  postback?: {
    data: string
  }
}

interface LineWebhookBody {
  destination: string
  events: LineWebhookEvent[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Bodyを取得
  const body = await request.text()
  const signature = request.headers.get('x-line-signature')

  // チャンネルIDからアカウントを特定（destinationから）
  const parsed: LineWebhookBody = JSON.parse(body)
  const destination = parsed.destination

  const { data: account } = await supabase
    .from('line_accounts')
    .select('*')
    .eq('bot_basic_id', destination)
    .single()

  if (!account) {
    // アカウントが見つからない場合でも200を返す（LINE仕様）
    return NextResponse.json({ success: true })
  }

  // 署名検証
  const client = new LineClient(account.access_token, account.channel_secret)
  if (!signature || !client.verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // イベント処理
  for (const event of parsed.events) {
    await handleLineEvent(supabase, account, event)
  }

  return NextResponse.json({ success: true })
}

async function handleLineEvent(
  supabase: any,
  account: any,
  event: LineWebhookEvent
) {
  const lineUserId = event.source.userId

  if (!lineUserId) return

  switch (event.type) {
    case 'follow':
      await handleFollowEvent(supabase, account, lineUserId)
      break
    case 'unfollow':
      await handleUnfollowEvent(supabase, account, lineUserId)
      break
    case 'message':
      await handleMessageEvent(supabase, account, lineUserId, event.message)
      break
    case 'postback':
      await handlePostbackEvent(supabase, account, lineUserId, event.postback)
      break
  }
}

async function handleFollowEvent(
  supabase: any,
  account: any,
  lineUserId: string
) {
  // プロフィール取得
  const client = new LineClient(account.access_token, account.channel_secret)
  let profile = { displayName: '', pictureUrl: '' }

  try {
    profile = await client.getProfile(lineUserId)
  } catch (err) {
    // プロフィール取得失敗は無視
  }

  // 既存のリンクがあるか確認
  const { data: existingLink } = await supabase
    .from('contact_line_links')
    .select('*')
    .eq('line_user_id', lineUserId)
    .eq('line_account_id', account.id)
    .single()

  if (!existingLink) {
    // 新規コンタクトを作成してリンク
    // または既存コンタクトとの紐付けフローを開始
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({
        user_id: account.user_id,
        name: profile.displayName || 'LINE User',
        source: 'line'
      })
      .select()
      .single()

    if (newContact) {
      await supabase
        .from('contact_line_links')
        .insert({
          contact_id: newContact.id,
          line_user_id: lineUserId,
          line_account_id: account.id,
          display_name: profile.displayName,
          picture_url: profile.pictureUrl
        })
    }
  }
}

async function handleUnfollowEvent(
  supabase: any,
  account: any,
  lineUserId: string
) {
  // ブロック時の処理（リンクは残すがステータス更新等）
  await supabase
    .from('contact_line_links')
    .update({ status: 'blocked' })
    .eq('line_user_id', lineUserId)
    .eq('line_account_id', account.id)
}

async function handleMessageEvent(
  supabase: any,
  account: any,
  lineUserId: string,
  message: any
) {
  // メッセージ受信時の処理
  // 自動応答やキーワードトリガー等

  // メッセージログ保存
  await supabase
    .from('line_messages')
    .insert({
      line_account_id: account.id,
      line_user_id: lineUserId,
      message_type: 'received',
      content: message,
      status: 'delivered'
    })
}

async function handlePostbackEvent(
  supabase: any,
  account: any,
  lineUserId: string,
  postback: any
) {
  // ポストバック（ボタンクリック等）の処理
  const data = new URLSearchParams(postback.data)
  const action = data.get('action')

  switch (action) {
    case 'link_email':
      // メールアドレス紐付けフロー開始
      break
    case 'scenario_trigger':
      // シナリオトリガー
      const scenarioId = data.get('scenario_id')
      // シナリオ登録処理...
      break
  }
}
```

---

## 4. コンタクト-LINE紐付け

### lib/line/line-linker.ts
```typescript
import crypto from 'crypto'

// 紐付け用トークン生成
export function generateLinkToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// トークン検証（24時間有効）
export function isTokenValid(createdAt: Date): boolean {
  const now = new Date()
  const diff = now.getTime() - createdAt.getTime()
  return diff < 24 * 60 * 60 * 1000
}
```

### app/api/contacts/[id]/line-link/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLinkToken } from '@/lib/line/line-linker'

// POST: 紐付けリンク生成
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { line_account_id } = await request.json()

  // 紐付けトークン生成
  const token = generateLinkToken()

  // トークンを一時保存
  await supabase
    .from('link_tokens')
    .insert({
      token,
      contact_id: params.id,
      line_account_id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })

  // 紐付け用URL生成
  const linkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/line/link?token=${token}`

  return NextResponse.json({ success: true, data: { linkUrl, token } })
}

// DELETE: 紐付け解除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  await supabase
    .from('contact_line_links')
    .delete()
    .eq('contact_id', params.id)

  return NextResponse.json({ success: true })
}
```

---

## 5. LINEメッセージ送信ステップ

### lib/scenarios/step-executors/line-step.ts
```typescript
import { LineClient, buildTextMessage, buildFlexMessage } from '@/lib/line/line-client'
import { ScenarioEnrollment, ScenarioStep } from '@/lib/types/l-step'

export async function executeLineStep(
  supabase: any,
  enrollment: ScenarioEnrollment,
  step: ScenarioStep
) {
  // コンタクトのLINE紐付けを取得
  const { data: lineLink } = await supabase
    .from('contact_line_links')
    .select(`
      *,
      line_account:line_accounts(*)
    `)
    .eq('contact_id', enrollment.contact_id)
    .single()

  if (!lineLink || !lineLink.line_account) {
    // LINE未連携の場合はスキップ
    return
  }

  const config = step.config
  const account = lineLink.line_account

  const client = new LineClient(account.access_token, account.channel_secret)

  // メッセージ構築
  let messages = []

  switch (config.line_message_type) {
    case 'text':
      messages.push(buildTextMessage(config.line_content?.text as string || ''))
      break
    case 'flex':
      messages.push(buildFlexMessage(
        config.line_content?.altText as string || 'メッセージ',
        config.line_content?.contents as Record<string, unknown>
      ))
      break
  }

  // 送信
  await client.pushMessage(lineLink.line_user_id, messages)

  // ログ保存
  await supabase
    .from('line_messages')
    .insert({
      line_account_id: account.id,
      contact_id: enrollment.contact_id,
      line_user_id: lineLink.line_user_id,
      message_type: 'sent',
      content: messages[0],
      status: 'sent',
      sent_at: new Date().toISOString()
    })
}
```

### lib/scenarios/scenario-processor.ts 更新
```typescript
import { executeLineStep } from './step-executors/line-step'

// processEnrollment 内
case 'line':
  await executeLineStep(supabase, enrollment, step)
  break
```

---

## 6. UI: LINE設定画面

### app/dashboard/settings/line/page.tsx
```typescript
import { createClient } from '@/lib/supabase/server'
import { LineAccountList } from '@/components/line/line-account-list'
import { LineConnectForm } from '@/components/line/line-connect-form'

export default async function LineSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: accounts } = await supabase
    .from('line_accounts')
    .select('id, channel_id, bot_basic_id, display_name, status, created_at')
    .eq('user_id', user?.id)

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">LINE連携設定</h1>

      <div className="grid gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">連携済みアカウント</h2>
          <LineAccountList accounts={accounts || []} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">新規連携</h2>
          <LineConnectForm />
        </section>
      </div>
    </div>
  )
}
```

### components/line/line-connect-form.tsx
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LineConnectForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    channel_id: '',
    channel_secret: '',
    access_token: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/line/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        window.location.reload()
      } else {
        alert(result.error)
      }
    } catch (err) {
      alert('接続に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LINE公式アカウントを連携</CardTitle>
        <CardDescription>
          LINE Developersコンソールから取得した情報を入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="channel_id">Channel ID</Label>
            <Input
              id="channel_id"
              value={formData.channel_id}
              onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
              placeholder="1234567890"
              required
            />
          </div>

          <div>
            <Label htmlFor="channel_secret">Channel Secret</Label>
            <Input
              id="channel_secret"
              type="password"
              value={formData.channel_secret}
              onChange={(e) => setFormData({ ...formData, channel_secret: e.target.value })}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </div>

          <div>
            <Label htmlFor="access_token">Channel Access Token</Label>
            <Input
              id="access_token"
              type="password"
              value={formData.access_token}
              onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
              placeholder="長期のChannel Access Token"
              required
            />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? '接続中...' : '連携する'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

---

## 7. シナリオビルダーへのLINEステップ追加

### components/scenarios/step-node.tsx に追加
```typescript
// LINEステップの設定UI
{step.step_type === 'line' && (
  <div className="space-y-4">
    <Select
      value={step.config.line_message_type || 'text'}
      onValueChange={(v) => handleConfigChange('line_message_type', v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="メッセージタイプ" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="text">テキスト</SelectItem>
        <SelectItem value="flex">Flexメッセージ</SelectItem>
      </SelectContent>
    </Select>

    {step.config.line_message_type === 'text' && (
      <Textarea
        placeholder="メッセージ内容"
        value={step.config.line_content?.text || ''}
        onChange={(e) => handleConfigChange('line_content', { text: e.target.value })}
      />
    )}

    {step.config.line_message_type === 'flex' && (
      <div>
        <Label>Flex Message JSON</Label>
        <Textarea
          className="font-mono text-sm"
          rows={10}
          placeholder='{"type": "bubble", ...}'
          value={JSON.stringify(step.config.line_content?.contents || {}, null, 2)}
          onChange={(e) => {
            try {
              const contents = JSON.parse(e.target.value)
              handleConfigChange('line_content', { contents, altText: 'メッセージ' })
            } catch {}
          }}
        />
      </div>
    )}
  </div>
)}
```

---

## 環境変数

```bash
# .env.local に追加
# （個別アカウントはDBに保存するため、グローバル設定は不要）
# Webhook URLはデプロイ後に設定
# https://your-domain.com/api/webhooks/line
```

---

## 完了条件

- [ ] LINE公式アカウントを連携できる
- [ ] Webhook受信でフォロー/ブロックを検知
- [ ] コンタクトとLINE IDを紐付けできる
- [ ] シナリオからLINEメッセージを送信できる
- [ ] テストメッセージが送信できる
- [ ] Flexメッセージに対応
- [ ] LINE連携設定UIが動作する
- [ ] テストカバレッジ80%以上
