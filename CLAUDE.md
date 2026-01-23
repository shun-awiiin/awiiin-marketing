# HubSpot Alternative - Email Marketing Platform

## プロジェクト概要

HubSpotの代替となるメール配信・マーケティング管理プラットフォーム。
キャンペーン管理、コンタクト管理、配信性能分析、テンプレート管理などの機能を提供。

## 技術スタック

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Icons**: Lucide React
- **State**: React hooks + Server Components

## 重要なルール

### 1. コード構成

- ファイルは200-400行を目安、800行を超えない
- 機能/ドメインごとに整理（typeではなく）
- 高凝集・低結合を維持

### 2. コーディングスタイル

- 絵文字をコードやコメントに使わない
- イミュータブル操作を徹底（オブジェクト・配列を直接変更しない）
- `console.log` は本番コードに残さない
- try/catch で適切なエラーハンドリング
- Zodでバリデーション

### 3. テスト

- TDD: テストを先に書く
- 80%以上のカバレッジ
- ユーティリティは単体テスト
- APIは統合テスト
- 重要フローはE2Eテスト

### 4. セキュリティ

- シークレットをハードコードしない
- 機密データは環境変数で
- ユーザー入力は必ずバリデーション
- パラメータ化クエリのみ使用
- RLSポリシーで行レベルセキュリティ

## ディレクトリ構成

```
app/
├── api/               # API Routes
│   ├── campaigns/     # キャンペーン管理API
│   ├── contacts/      # コンタクト管理API
│   ├── templates/     # テンプレートAPI
│   └── webhooks/      # Webhook処理
├── auth/              # 認証ページ
├── dashboard/         # ダッシュボード
│   ├── analytics/     # 分析
│   ├── campaigns/     # キャンペーン管理
│   ├── contacts/      # コンタクト管理
│   ├── deliverability/# 配信性能
│   └── settings/      # 設定
components/
├── campaigns/         # キャンペーン関連コンポーネント
├── contacts/          # コンタクト関連コンポーネント
├── dashboard/         # ダッシュボードレイアウト
├── deliverability/    # 配信性能コンポーネント
├── templates/         # テンプレート関連
└── ui/                # shadcn/ui コンポーネント
lib/
├── auth/              # 認証ユーティリティ
├── deliverability/    # 配信性能計算
├── email/             # メール送信
├── supabase/          # Supabaseクライアント
└── validation/        # バリデーション
```

## 主要パターン

### API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### Supabase Client Usage

```typescript
// Server Component
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Component
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### Error Handling

```typescript
try {
  const result = await operation()
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  return { success: false, error: '操作に失敗しました' }
}
```

## 環境変数

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional
RESEND_API_KEY=           # メール送信用
SENDGRID_API_KEY=         # 代替メールサービス
```

## 利用可能なコマンド

- `/tdd` - テスト駆動開発ワークフロー
- `/plan` - 実装計画の作成
- `/code-review` - コードレビュー
- `/build-fix` - ビルドエラー修正
- `/e2e` - E2Eテスト生成

## Git ワークフロー

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- mainには直接コミットしない
- PRにはレビューが必要
- マージ前に全テストパス

## 日本語対応

- UIラベルは日本語
- エラーメッセージは具体的に（例：「メールアドレスの形式が正しくありません」）
- ボタンは動詞（「作成する」「保存」「削除」）
- 見出しは名詞（「キャンペーン一覧」「設定」）

## 注意事項

### Context Window管理

MCPを全て有効にしない。200kのコンテキストウィンドウが70kに縮小する可能性あり。

- 設定済みMCP: 20-30個
- プロジェクトで有効化: 10個以下
- アクティブツール: 80個以下

### カスタマイズ

このプロジェクトに不要な設定は削除・無効化してOK。
