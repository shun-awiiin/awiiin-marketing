# Phase 6: テスト・最適化

## 実行コマンド
```bash
/l-step phase6
```

## 前提条件
- Phase 1-5 完了済み

## タスク概要
全機能のテストを実装し、パフォーマンスを最適化する。

---

## 1. 単体テスト

### lib/scenarios/__tests__/scenario-processor.test.ts
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processScenarios, processEnrollment } from '../scenario-processor'

describe('ScenarioProcessor', () => {
  const mockSupabase = {
    from: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processScenarios', () => {
    it('processes enrollments with next_action_at <= now', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          scenario_id: 'scenario-1',
          contact_id: 'contact-1',
          current_step_id: 'step-1',
          status: 'active',
          next_action_at: new Date(Date.now() - 1000).toISOString(),
          scenario: { id: 'scenario-1', status: 'active' },
          current_step: { id: 'step-1', step_type: 'email', config: {} }
        }
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'scenario_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null })
                })
              })
            })
          }
        }
        return { select: vi.fn() }
      })

      const result = await processScenarios()

      expect(result.processed).toBeGreaterThanOrEqual(0)
    })

    it('skips enrollments with future next_action_at', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      })

      const result = await processScenarios()

      expect(result.processed).toBe(0)
    })
  })

  describe('processEnrollment', () => {
    it('executes email step and moves to next step', async () => {
      // テスト実装
    })

    it('executes wait step correctly', async () => {
      // テスト実装
    })

    it('marks enrollment as completed when no next step', async () => {
      // テスト実装
    })
  })
})
```

### lib/segments/__tests__/segment-evaluator.test.ts
```typescript
import { describe, it, expect, vi } from 'vitest'
import { evaluateSegment, countSegmentContacts } from '../segment-evaluator'

describe('SegmentEvaluator', () => {
  const mockSupabase = {
    from: vi.fn()
  }

  describe('evaluateSegment', () => {
    it('returns all contacts when no conditions', async () => {
      const mockContacts = [
        { id: 'contact-1', name: 'Test 1' },
        { id: 'contact-2', name: 'Test 2' }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockContacts, error: null })
        })
      })

      const result = await evaluateSegment(mockSupabase, 'user-1', {
        operator: 'AND',
        conditions: []
      })

      expect(result).toHaveLength(2)
    })

    it('filters by tag condition with AND operator', async () => {
      // テスト実装
    })

    it('filters by custom field condition', async () => {
      // テスト実装
    })

    it('combines conditions with OR operator', async () => {
      // テスト実装
    })
  })

  describe('countSegmentContacts', () => {
    it('returns correct count', async () => {
      // テスト実装
    })
  })
})
```

### lib/line/__tests__/line-client.test.ts
```typescript
import { describe, it, expect, vi } from 'vitest'
import { LineClient, buildTextMessage, buildFlexMessage } from '../line-client'

describe('LineClient', () => {
  describe('verifySignature', () => {
    it('returns true for valid signature', () => {
      const client = new LineClient('token', 'secret')
      const body = '{"events":[]}'
      // 正しい署名を計算
      const crypto = require('crypto')
      const validSignature = crypto
        .createHmac('sha256', 'secret')
        .update(body)
        .digest('base64')

      expect(client.verifySignature(body, validSignature)).toBe(true)
    })

    it('returns false for invalid signature', () => {
      const client = new LineClient('token', 'secret')
      expect(client.verifySignature('body', 'invalid')).toBe(false)
    })
  })

  describe('pushMessage', () => {
    it('sends message successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const client = new LineClient('token', 'secret')
      await expect(
        client.pushMessage('user-id', [buildTextMessage('Hello')])
      ).resolves.not.toThrow()

      expect(fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer token'
          })
        })
      )
    })

    it('throws error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid token' })
      })

      const client = new LineClient('invalid', 'secret')
      await expect(
        client.pushMessage('user-id', [buildTextMessage('Hello')])
      ).rejects.toThrow()
    })
  })

  describe('message builders', () => {
    it('builds text message correctly', () => {
      const message = buildTextMessage('Hello')
      expect(message).toEqual({
        type: 'text',
        text: 'Hello'
      })
    })

    it('builds flex message correctly', () => {
      const contents = { type: 'bubble', body: {} }
      const message = buildFlexMessage('Alt text', contents)
      expect(message).toEqual({
        type: 'flex',
        altText: 'Alt text',
        contents
      })
    })
  })
})
```

---

## 2. 統合テスト

### app/api/scenarios/__tests__/integration.test.ts
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('Scenarios API Integration', () => {
  let supabase: any
  let testUserId: string
  let testScenarioId: string

  beforeAll(async () => {
    // テスト用Supabaseクライアント
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // テストユーザー作成
    const { data: user } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpassword'
    })
    testUserId = user?.user?.id
  })

  afterAll(async () => {
    // クリーンアップ
    if (testScenarioId) {
      await supabase.from('scenarios').delete().eq('id', testScenarioId)
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId)
    }
  })

  it('creates a scenario', async () => {
    const response = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Scenario',
        description: 'Test description'
      })
    })

    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('Test Scenario')
    testScenarioId = result.data.id
  })

  it('adds steps to scenario', async () => {
    const response = await fetch(`/api/scenarios/${testScenarioId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step_type: 'email',
        name: 'Welcome Email',
        config: {
          subject: 'Welcome!',
          content: '<p>Hello!</p>'
        }
      })
    })

    const result = await response.json()
    expect(result.success).toBe(true)
  })

  it('enrolls contact in scenario', async () => {
    // テストコンタクト作成
    const { data: contact } = await supabase
      .from('contacts')
      .insert({ user_id: testUserId, email: 'contact@test.com' })
      .select()
      .single()

    const response = await fetch(`/api/scenarios/${testScenarioId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_ids: [contact.id]
      })
    })

    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.enrolled).toBe(1)
  })
})
```

### app/api/segments/__tests__/integration.test.ts
```typescript
import { describe, it, expect } from 'vitest'

describe('Segments API Integration', () => {
  it('creates segment and counts contacts', async () => {
    // セグメント作成
    const createResponse = await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Segment',
        rules: {
          operator: 'AND',
          conditions: [
            { type: 'tag', operator: 'exists', value: 'tag-1' }
          ]
        }
      })
    })

    const createResult = await createResponse.json()
    expect(createResult.success).toBe(true)

    // コンタクト取得
    const contactsResponse = await fetch(
      `/api/segments/${createResult.data.id}/contacts`
    )
    const contactsResult = await contactsResponse.json()
    expect(contactsResult.success).toBe(true)
    expect(Array.isArray(contactsResult.data)).toBe(true)
  })
})
```

---

## 3. E2Eテスト

### e2e/scenarios.spec.ts
```typescript
import { test, expect } from '@playwright/test'

test.describe('Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('creates a new scenario', async ({ page }) => {
    await page.goto('/dashboard/scenarios')
    await page.click('text=新規作成')

    await page.fill('input[name="name"]', 'E2E Test Scenario')
    await page.fill('textarea[name="description"]', 'Created by E2E test')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=シナリオを作成しました')).toBeVisible()
  })

  test('adds email step to scenario', async ({ page }) => {
    await page.goto('/dashboard/scenarios')
    await page.click('text=E2E Test Scenario')

    await page.click('text=ステップを追加')
    await page.click('text=メール')

    await page.fill('input[name="subject"]', 'Test Email')
    await page.fill('[contenteditable]', 'Test content')
    await page.click('text=保存')

    await expect(page.locator('text=Test Email')).toBeVisible()
  })

  test('activates scenario', async ({ page }) => {
    await page.goto('/dashboard/scenarios')
    await page.click('text=E2E Test Scenario')

    await page.click('text=有効化')
    await page.click('text=確認')

    await expect(page.locator('text=有効')).toBeVisible()
  })
})
```

### e2e/segments.spec.ts
```typescript
import { test, expect } from '@playwright/test'

test.describe('Segments', () => {
  test('creates segment with tag condition', async ({ page }) => {
    await page.goto('/dashboard/segments/new')

    await page.fill('input[name="name"]', 'Active Users')
    await page.click('text=条件を追加')
    await page.selectOption('select:first-of-type', 'tag')
    await page.selectOption('select:nth-of-type(2)', 'exists')
    await page.click('text=保存')

    await expect(page.locator('text=セグメントを作成しました')).toBeVisible()
  })

  test('shows contact count in real-time', async ({ page }) => {
    await page.goto('/dashboard/segments/new')

    await page.fill('input[name="name"]', 'Test Segment')
    await page.click('text=条件を追加')

    // 条件設定後にカウントが更新されることを確認
    await expect(page.locator('text=該当者:')).toBeVisible()
  })
})
```

### e2e/line.spec.ts
```typescript
import { test, expect } from '@playwright/test'

test.describe('LINE Integration', () => {
  test('shows LINE settings page', async ({ page }) => {
    await page.goto('/dashboard/settings/line')

    await expect(page.locator('text=LINE連携設定')).toBeVisible()
    await expect(page.locator('text=新規連携')).toBeVisible()
  })

  test('validates LINE credentials on connect', async ({ page }) => {
    await page.goto('/dashboard/settings/line')

    await page.fill('input[name="channel_id"]', 'invalid')
    await page.fill('input[name="channel_secret"]', 'invalid')
    await page.fill('input[name="access_token"]', 'invalid')
    await page.click('text=連携する')

    await expect(page.locator('text=接続に失敗しました')).toBeVisible()
  })
})
```

---

## 4. パフォーマンス最適化

### lib/scenarios/scenario-processor.ts 最適化
```typescript
// バッチ処理の最適化
export async function processScenarios() {
  const supabase = await createClient()

  // 分散ロックを取得（重複実行防止）
  const { data: lock } = await supabase.rpc('acquire_advisory_lock', {
    lock_key: 12345 // シナリオ処理用のロックキー
  })

  if (!lock) {
    return { processed: 0, errors: [], skipped: true }
  }

  try {
    // バッチサイズを調整（メモリ効率）
    const BATCH_SIZE = 100

    const { data: enrollments } = await supabase
      .from('scenario_enrollments')
      .select(`
        id, scenario_id, contact_id, current_step_id, status,
        enrolled_at, next_action_at, metadata,
        scenario:scenarios!inner(id, status),
        current_step:scenario_steps(*)
      `)
      .eq('status', 'active')
      .eq('scenarios.status', 'active')
      .lte('next_action_at', new Date().toISOString())
      .limit(BATCH_SIZE)

    // 並列処理（制限付き）
    const CONCURRENCY = 10
    const results = await processInBatches(
      enrollments || [],
      CONCURRENCY,
      async (enrollment) => {
        await processEnrollment(supabase, enrollment)
      }
    )

    return results
  } finally {
    // ロック解放
    await supabase.rpc('release_advisory_lock', { lock_key: 12345 })
  }
}

async function processInBatches<T>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<void>
) {
  const results = { processed: 0, errors: [] as string[] }

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const promises = batch.map(async (item, index) => {
      try {
        await processor(item)
        results.processed++
      } catch (err) {
        results.errors.push(`Item ${i + index}: ${err}`)
      }
    })
    await Promise.all(promises)
  }

  return results
}
```

### lib/segments/segment-evaluator.ts 最適化
```typescript
// クエリキャッシュ
const CACHE_TTL = 60 * 1000 // 1分
const segmentCache = new Map<string, { data: any[], timestamp: number }>()

export async function evaluateSegmentCached(
  supabase: any,
  userId: string,
  rules: SegmentRules,
  segmentId: string
): Promise<any[]> {
  const cacheKey = `${segmentId}:${JSON.stringify(rules)}`
  const cached = segmentCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const result = await evaluateSegment(supabase, userId, rules)

  segmentCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  })

  return result
}

// インデックス推奨
// supabase/migrations/YYYYMMDD_indexes.sql
/*
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_contact_tag
  ON contact_tags(contact_id, tag_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_values_lookup
  ON contact_custom_values(field_id, value);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_processing
  ON scenario_enrollments(next_action_at)
  WHERE status = 'active';
*/
```

---

## 5. カバレッジレポート設定

### vitest.config.ts 更新
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
```

### package.json scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

---

## 6. 監視・アラート

### lib/monitoring/scenario-monitor.ts
```typescript
export async function monitorScenarioHealth(supabase: any) {
  // 滞留チェック（next_action_atから1時間以上経過）
  const { data: staleEnrollments } = await supabase
    .from('scenario_enrollments')
    .select('count')
    .eq('status', 'active')
    .lt('next_action_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (staleEnrollments?.[0]?.count > 100) {
    // アラート送信
    console.error(`[ALERT] ${staleEnrollments[0].count} stale enrollments detected`)
  }

  // エラー率チェック
  const { data: recentErrors } = await supabase
    .from('scenario_logs')
    .select('count')
    .eq('level', 'error')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (recentErrors?.[0]?.count > 10) {
    console.error(`[ALERT] High error rate: ${recentErrors[0].count} errors in last hour`)
  }
}
```

---

## 完了条件

- [ ] 単体テストカバレッジ80%以上
- [ ] 統合テストが全てパス
- [ ] E2Eテストが全てパス
- [ ] シナリオ処理の並列化・バッチ処理実装
- [ ] セグメントクエリのキャッシュ実装
- [ ] データベースインデックス最適化
- [ ] 監視・アラート設定
- [ ] `npm run test:all` が成功
