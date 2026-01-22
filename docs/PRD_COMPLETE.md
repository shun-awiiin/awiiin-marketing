# HubSpot代替メール配信ツール - 完全仕様書（確定版）

**バージョン**: 1.0.0
**最終更新**: 2026-01-23
**ステータス**: 実装準備完了

---

## 0. プロダクト定義

### 0-1. ミッション

「到達率最優先 × コスト最小 × 作成が超ラク」に全振りした、セミナー案内・無料登録案内特化のメール配信ツール。

### 0-2. 目的

1. **メール到達率を最大化** - Gmail/Outlookに嫌われない設計
2. **コスト最小化** - 席課金なし、従量課金中心
3. **作成を最短化** - 文章を"書かせない"UI

### 0-3. 対象ユースケース

| ユースケース | 説明 |
|------------|------|
| セミナー案内 | ウェビナー、勉強会、説明会への招待 |
| 無料登録案内 | β募集、無料トライアル、無料登録導線 |

### 0-4. 非対象（MVPでやらない）

- 本格的なCRM（パイプライン、商談管理）
- 高度なマーケ計測（複雑なMA、スコアリング、ABテスト）
- HTMLドラッグ＆ドロップエディタ（到達率を壊すため）
- リッチメディア送信（画像、動画、添付ファイル）

---

## 1. 技術スタック

### 1-1. フロントエンド

| 技術 | バージョン | 用途 |
|-----|----------|------|
| Next.js | 16.x | フレームワーク |
| React | 19.x | UI |
| Tailwind CSS | 4.x | スタイリング |
| shadcn/ui | latest | コンポーネント |
| React Hook Form | 7.x | フォーム管理 |
| Zod | 3.x | バリデーション |

### 1-2. バックエンド

| 技術 | 用途 |
|-----|------|
| Supabase | データベース、認証、リアルタイム |
| Amazon SES | メール送信（本番推奨） |
| Resend | メール送信（代替） |
| Vercel | ホスティング、Edge Functions |

### 1-3. インフラ

| 構成要素 | 設定 |
|---------|------|
| Webドメイン | `awiiin.com` |
| メール送信ドメイン | `m.awiiin.com`（サブドメイン分離必須） |
| DNS | SPF, DKIM, DMARC 設定必須 |

---

## 2. テンプレートシステム

### 2-1. テンプレートタイプ（固定2種）

```typescript
enum TemplateType {
  SEMINAR_INVITE = 'SEMINAR_INVITE',      // セミナー案内
  FREE_TRIAL_INVITE = 'FREE_TRIAL_INVITE'  // 無料登録案内
}
```

### 2-2. 入力フォーム定義

#### セミナー案内（SEMINAR_INVITE）

| フィールド | 必須 | 型 | 制約 | 例 |
|-----------|------|-----|------|-----|
| `event_name` | ○ | string | 最大60文字 | 「AI活用セミナー」 |
| `event_date` | ○ | string | 最大30文字 | 「1月31日（金）14:00〜」 |
| `event_location` | ○ | string | 最大40文字 | 「オンライン（Zoom）」 |
| `url` | ○ | string | 有効なURL、1つのみ | `https://example.com/seminar` |
| `extra_bullets` | - | string[] | 最大3行、各80文字 | 追加の案内事項 |

#### 無料登録案内（FREE_TRIAL_INVITE）

| フィールド | 必須 | 型 | 制約 | 例 |
|-----------|------|-----|------|-----|
| `tool_name` | ○ | string | 最大30文字 | 「Musashi」 |
| `one_liner` | ○ | string | 最大120文字 | 「営業リスト作成を自動化するツール」 |
| `url` | ○ | string | 有効なURL、1つのみ | `https://example.com/signup` |
| `extra_bullets` | - | string[] | 最大3行、各80文字 | 追加の案内事項 |

### 2-3. 差し込み変数（固定）

| 変数 | フォールバック | 説明 |
|-----|---------------|------|
| `{{firstName}}` | 「ご担当者さま」 | 受信者の名前 |

### 2-4. 出力フォーマット（到達率最優先）

| 項目 | MVP設定 | 理由 |
|-----|---------|------|
| フォーマット | **text/plain のみ** | 到達率最優先 |
| HTML | 送らない | スパム判定リスク |
| URL | 本文中1回のみ | 複数URLはスパム判定 |
| 画像 | 禁止 | 到達率低下 |
| 絵文字 | 件名に1個まで（既定は無し） | 過剰使用でスパム判定 |
| 添付 | 禁止 | 到達率低下 |

### 2-5. 件名生成ルール（固定候補から選択）

#### セミナー案内の件名候補

```
1. {{firstName}}さん、1点だけ共有です
2. {{firstName}}さん向けにご連絡です（短時間）
3. {{firstName}}さん、来週の件でご案内です
```

#### 無料登録案内の件名候補

```
1. {{firstName}}さん、先日の件で1点だけ
2. {{firstName}}さん向けに共有です
3. {{firstName}}さん、ご参考までに
```

### 2-6. 本文テンプレート（固定）

#### セミナー案内

```text
{{firstName}}さん

お世話になっております。
Awiiinの菊池です。

{{event_name}}を開催することになりました。
{{event_date}}
{{event_location}}

もしご興味あればご参加ください。
{{url}}

{{#extra_bullets}}
{{.}}
{{/extra_bullets}}

不要でしたら無視で大丈夫です。

Awiiin
菊池
```

#### 無料登録案内

```text
{{firstName}}さん

先日はありがとうございました。
Awiiinの菊池です。

その後、何名かの方から「試してみたい」という声があったので
一応共有です。

{{tool_name}}：{{one_liner}}

こちらから確認できます。
{{url}}

{{#extra_bullets}}
{{.}}
{{/extra_bullets}}

不要でしたら無視で大丈夫です。

Awiiin
菊池
```

---

## 3. 到達率ガードレール（強制ルール）

### 3-1. UIで物理的に禁止（入力不可）

| 制限項目 | 制限内容 |
|---------|---------|
| リンク | **1つ以外入力不可** |
| 画像 | アップロードUI自体なし |
| 添付 | 添付UI自体なし |
| HTML | HTMLエディタなし |
| CC/BCC | 入力欄なし |
| 件名自由編集 | 候補から選択のみ |
| 送信上限 | **1キャンペーン最大5,000件**（MVP） |

### 3-2. 送信スロットリング（必須）

| パラメータ | 初期値 | 上限 | 備考 |
|-----------|-------|------|------|
| `messages_per_minute` | 20 | 200 | 管理者のみ変更可 |
| 初回7日間制限 | 200通/日 | - | 新規ドメイン保護 |
| バッチサイズ | 50通 | - | 送信処理単位 |
| 送信間隔 | 2秒 | - | 各メール間 |

### 3-3. 自動停止ルール

| トリガー | 閾値 | アクション |
|---------|------|----------|
| Hard Bounce率 | ≥ 5% | 即時停止 + 管理者通知 |
| Complaint率 | ≥ 0.1% | 即時停止 + 管理者通知 |
| 連続失敗 | 10件連続 | 一時停止 + 確認待ち |

### 3-4. 自動除外ルール

| イベント | アクション |
|---------|----------|
| Hard Bounce | contact.status → `bounced`、以後送信対象外 |
| Complaint（苦情） | contact.status → `complained`、以後送信対象外 |
| Unsubscribe | contact.status → `unsubscribed`、以後送信対象外 |
| Soft Bounce 3回 | contact.status → `bounced`、以後送信対象外 |

---

## 4. メール送信インフラ

### 4-1. 推奨構成

| 役割 | サービス | 理由 |
|-----|---------|------|
| メイン送信 | Amazon SES | コスト最安、到達率高 |
| フォールバック | Resend | 導入容易、API互換 |
| Webhook受信 | Vercel Serverless | SESイベント処理 |

### 4-2. SES設定要件

```
送信ドメイン: m.awiiin.com
MAIL FROM: bounce.m.awiiin.com

DNS設定:
- SPF: v=spf1 include:amazonses.com ~all
- DKIM: SES発行の3つのCNAME
- DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@awiiin.com
- MX (MAIL FROM): feedback-smtp.ap-northeast-1.amazonses.com
```

### 4-3. Webhook設定

| イベント | 処理 |
|---------|------|
| `Delivery` | messages.status → `delivered` |
| `Bounce` | messages.status → `bounced`、contacts.status更新 |
| `Complaint` | messages.status → `complained`、contacts.status更新、キャンペーン停止判定 |
| `Open` | events記録（将来用、MVPでは計測しない） |
| `Click` | events記録（将来用、MVPでは計測しない） |

---

## 5. データモデル（完全定義）

### 5-1. ER図概要

```
users ─┬─< campaigns ─< messages
       │       │
       │       └─< campaign_tags >─ tags
       │
       └─< contacts ─< contact_tags >─ tags
              │
              └─< unsubscribes

events（独立、provider_message_idで紐付け）
audit_logs（独立、アクション記録）
templates（プリセット + ユーザー作成）
```

### 5-2. テーブル定義

#### `users`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | Supabase Auth連携 |
| email | varchar(255) | UNIQUE, NOT NULL | メールアドレス |
| role | enum | NOT NULL, DEFAULT 'editor' | `admin` / `editor` / `viewer` |
| display_name | varchar(100) | | 表示名 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

#### `contacts`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| user_id | uuid | FK(users), NOT NULL | 所有者 |
| email | varchar(255) | NOT NULL | メールアドレス |
| first_name | varchar(100) | | 名前（差し込み用） |
| company | varchar(200) | | 会社名 |
| status | enum | NOT NULL, DEFAULT 'active' | `active` / `bounced` / `complained` / `unsubscribed` |
| soft_bounce_count | int | DEFAULT 0 | ソフトバウンス回数 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**UNIQUE制約**: `(user_id, email)`

#### `tags`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| user_id | uuid | FK(users), NOT NULL | 所有者 |
| name | varchar(50) | NOT NULL | タグ名 |
| color | varchar(7) | DEFAULT '#6B7280' | 表示色（HEX） |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**UNIQUE制約**: `(user_id, name)`

#### `contact_tags`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| contact_id | uuid | FK(contacts), NOT NULL | |
| tag_id | uuid | FK(tags), NOT NULL | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**PK**: `(contact_id, tag_id)`

#### `templates`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| user_id | uuid | FK(users), NULLABLE | NULL=プリセット |
| name | varchar(100) | NOT NULL | テンプレート名 |
| type | enum | NOT NULL | `SEMINAR_INVITE` / `FREE_TRIAL_INVITE` |
| category | varchar(50) | NOT NULL | `seminar` / `registration` / `custom` |
| subject_variants | jsonb | NOT NULL | 件名候補の配列 |
| body_text | text | NOT NULL | 本文テンプレート |
| is_preset | boolean | NOT NULL, DEFAULT false | プリセットフラグ |
| is_active | boolean | NOT NULL, DEFAULT true | 有効フラグ |
| version | int | NOT NULL, DEFAULT 1 | バージョン |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

#### `campaigns`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| user_id | uuid | FK(users), NOT NULL | 作成者 |
| name | varchar(200) | NOT NULL | キャンペーン名 |
| template_id | uuid | FK(templates), NOT NULL | 使用テンプレート |
| type | enum | NOT NULL | `SEMINAR_INVITE` / `FREE_TRIAL_INVITE` |
| input_payload | jsonb | NOT NULL | フォーム入力値 |
| subject_override | varchar(200) | | 件名（選択/カスタム） |
| body_override | text | | 本文（生成済み） |
| variables | jsonb | | 追加変数 |
| filter_tags | uuid[] | | 対象タグID配列 |
| from_name | varchar(100) | NOT NULL | 送信者名 |
| from_email | varchar(255) | NOT NULL | 送信元アドレス |
| rate_limit_per_minute | int | NOT NULL, DEFAULT 20 | 送信レート |
| status | enum | NOT NULL, DEFAULT 'draft' | 下記参照 |
| scheduled_at | timestamptz | | 予約送信日時 |
| started_at | timestamptz | | 送信開始日時 |
| completed_at | timestamptz | | 完了日時 |
| paused_at | timestamptz | | 一時停止日時 |
| stop_reason | varchar(200) | | 停止理由 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Campaign Status Enum**:
```typescript
enum CampaignStatus {
  draft = 'draft',           // 下書き
  scheduled = 'scheduled',   // 予約済み
  queued = 'queued',         // キュー投入済み
  sending = 'sending',       // 送信中
  paused = 'paused',         // 一時停止
  completed = 'completed',   // 完了
  stopped = 'stopped',       // 強制停止
  failed = 'failed'          // 失敗
}
```

#### `messages`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| campaign_id | uuid | FK(campaigns), NOT NULL | |
| contact_id | uuid | FK(contacts), NOT NULL | |
| to_email | varchar(255) | NOT NULL | 送信先（スナップショット） |
| subject | varchar(200) | NOT NULL | 件名（レンダリング済み） |
| body_text | text | NOT NULL | 本文（レンダリング済み） |
| status | enum | NOT NULL, DEFAULT 'queued' | 下記参照 |
| provider_message_id | varchar(255) | | SES Message ID |
| retry_count | int | NOT NULL, DEFAULT 0 | リトライ回数 |
| last_error | text | | 最後のエラー |
| queued_at | timestamptz | NOT NULL, DEFAULT now() | |
| sent_at | timestamptz | | 送信日時 |
| delivered_at | timestamptz | | 配信確認日時 |
| bounced_at | timestamptz | | バウンス日時 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Message Status Enum**:
```typescript
enum MessageStatus {
  queued = 'queued',         // キュー待ち
  sending = 'sending',       // 送信処理中
  sent = 'sent',             // 送信完了（SES受付）
  delivered = 'delivered',   // 配信確認
  bounced = 'bounced',       // バウンス
  complained = 'complained', // 苦情報告
  failed = 'failed'          // 送信失敗
}
```

#### `events`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| provider | varchar(20) | NOT NULL | `ses` / `resend` / `sendgrid` |
| provider_message_id | varchar(255) | | プロバイダのMessage ID |
| event_type | varchar(50) | NOT NULL | イベント種別 |
| email | varchar(255) | | 対象メールアドレス |
| campaign_id | uuid | FK(campaigns) | 関連キャンペーン |
| payload | jsonb | | 生データ |
| occurred_at | timestamptz | NOT NULL | イベント発生日時 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**インデックス**: `(provider_message_id)`, `(campaign_id)`, `(email)`, `(event_type)`

#### `unsubscribes`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| email | varchar(255) | UNIQUE, NOT NULL | 配信停止アドレス |
| contact_id | uuid | FK(contacts) | 関連連絡先 |
| campaign_id | uuid | FK(campaigns) | 解除元キャンペーン |
| token | varchar(64) | UNIQUE | ワンクリック解除トークン |
| reason | varchar(200) | | 解除理由 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

#### `audit_logs`

| カラム | 型 | 制約 | 説明 |
|-------|-----|------|------|
| id | uuid | PK | |
| user_id | uuid | FK(users) | 実行者 |
| action | varchar(100) | NOT NULL | アクション種別 |
| target_type | varchar(50) | | 対象エンティティ種別 |
| target_id | uuid | | 対象ID |
| payload | jsonb | | 詳細データ |
| ip_address | inet | | IPアドレス |
| user_agent | text | | User-Agent |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Audit Actions**:
```
campaign.create, campaign.queue, campaign.start, campaign.pause,
campaign.resume, campaign.stop, campaign.delete,
contacts.import, contacts.update, contacts.delete,
template.create, template.update, template.delete,
user.login, user.logout, settings.update
```

---

## 6. API仕様（完全定義）

### 6-1. 認証

- **方式**: Supabase Auth（JWT）
- **ヘッダー**: `Authorization: Bearer <access_token>`

### 6-2. 共通レスポンス形式

```typescript
// 成功
{
  "data": T,
  "meta"?: {
    "total": number,
    "page": number,
    "per_page": number
  }
}

// エラー
{
  "error": {
    "code": string,
    "message": string,
    "details"?: object
  }
}
```

### 6-3. Contacts API

#### インポート

```
POST /api/contacts/import
Content-Type: multipart/form-data

Request:
- file: CSV file (email, firstName, company, tags)
- update_existing: boolean (default: true)

Response:
{
  "data": {
    "total": 1000,
    "created": 850,
    "updated": 100,
    "skipped": 30,
    "invalid": 20,
    "errors": [
      { "row": 15, "email": "invalid", "reason": "Invalid email format" }
    ]
  }
}
```

#### 一覧取得

```
GET /api/contacts?status=active&tag=xxx&page=1&per_page=50&search=keyword

Response:
{
  "data": [
    {
      "id": "uuid",
      "email": "test@example.com",
      "first_name": "田中",
      "company": "株式会社A",
      "status": "active",
      "tags": [{ "id": "uuid", "name": "セミナー参加者" }],
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": { "total": 1000, "page": 1, "per_page": 50 }
}
```

#### 更新

```
PATCH /api/contacts/:id

Request:
{
  "first_name": "山田",
  "company": "株式会社B",
  "tag_ids": ["uuid1", "uuid2"]
}

Response:
{
  "data": { "id": "uuid", ... }
}
```

#### 削除

```
DELETE /api/contacts/:id

Response:
{ "data": { "success": true } }
```

### 6-4. Tags API

#### 一覧

```
GET /api/tags

Response:
{
  "data": [
    { "id": "uuid", "name": "セミナー参加者", "color": "#3B82F6", "contact_count": 150 }
  ]
}
```

#### 作成

```
POST /api/tags

Request:
{ "name": "新規タグ", "color": "#10B981" }

Response:
{ "data": { "id": "uuid", "name": "新規タグ", "color": "#10B981" } }
```

#### 更新・削除

```
PATCH /api/tags/:id
DELETE /api/tags/:id
```

### 6-5. Templates API

#### 一覧

```
GET /api/templates?type=SEMINAR_INVITE

Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "セミナー案内（標準）",
      "type": "SEMINAR_INVITE",
      "category": "seminar",
      "subject_variants": ["{{firstName}}さん、1点だけ共有です", ...],
      "body_text": "...",
      "is_preset": true,
      "is_active": true
    }
  ]
}
```

#### 作成（カスタム）

```
POST /api/templates

Request:
{
  "name": "カスタムテンプレート",
  "type": "SEMINAR_INVITE",
  "subject_variants": ["件名1", "件名2"],
  "body_text": "本文..."
}
```

### 6-6. Campaigns API

#### 作成

```
POST /api/campaigns

Request:
{
  "name": "1月セミナー案内",
  "type": "SEMINAR_INVITE",
  "template_id": "uuid",
  "input_payload": {
    "event_name": "AI活用セミナー",
    "event_date": "1月31日（金）14:00〜",
    "event_location": "オンライン（Zoom）",
    "url": "https://example.com/seminar"
  },
  "subject_index": 0,  // 件名候補のインデックス
  "filter_tag_ids": ["uuid1", "uuid2"],  // 空配列 = 全員
  "from_name": "Awiiin 菊池",
  "from_email": "info@m.awiiin.com",
  "schedule_type": "now"  // "now" | "later"
  "scheduled_at": null    // schedule_type="later"の場合必須
}

Response:
{
  "data": {
    "id": "uuid",
    "name": "1月セミナー案内",
    "status": "draft",
    "audience_count": 500,
    ...
  }
}
```

#### プレビュー

```
POST /api/campaigns/:id/preview

Request:
{
  "sample_contact_id": "uuid"  // 省略時はダミーデータ
}

Response:
{
  "data": {
    "subject": "田中さん、1点だけ共有です",
    "body_text": "田中さん\n\nお世話になっております...",
    "from": "Awiiin 菊池 <info@m.awiiin.com>",
    "to": "tanaka@example.com"
  }
}
```

#### キュー投入（送信開始）

```
POST /api/campaigns/:id/queue

Response:
{
  "data": {
    "campaign_id": "uuid",
    "status": "queued",
    "total_messages": 500,
    "estimated_completion": "2024-01-15T15:30:00Z"
  }
}
```

#### 一時停止

```
POST /api/campaigns/:id/pause

Response:
{
  "data": {
    "status": "paused",
    "sent": 250,
    "remaining": 250
  }
}
```

#### 再開（adminのみ）

```
POST /api/campaigns/:id/resume

Response:
{
  "data": {
    "status": "sending",
    "remaining": 250
  }
}
```

#### 停止（adminのみ）

```
POST /api/campaigns/:id/stop

Response:
{
  "data": {
    "status": "stopped",
    "sent": 250,
    "cancelled": 250
  }
}
```

#### 詳細取得

```
GET /api/campaigns/:id

Response:
{
  "data": {
    "id": "uuid",
    "name": "1月セミナー案内",
    "status": "sending",
    "template": { ... },
    "stats": {
      "total": 500,
      "queued": 100,
      "sent": 300,
      "delivered": 280,
      "bounced": 5,
      "complained": 0,
      "failed": 15
    },
    "bounce_rate": 1.67,
    "complaint_rate": 0,
    "created_at": "...",
    "started_at": "...",
    ...
  }
}
```

#### 一覧

```
GET /api/campaigns?status=sending&page=1&per_page=20

Response:
{
  "data": [...],
  "meta": { "total": 50, "page": 1, "per_page": 20 }
}
```

#### メッセージ一覧

```
GET /api/campaigns/:id/messages?status=bounced&page=1&per_page=100

Response:
{
  "data": [
    {
      "id": "uuid",
      "to_email": "test@example.com",
      "subject": "...",
      "status": "bounced",
      "sent_at": "...",
      "bounced_at": "...",
      "last_error": "550 User unknown"
    }
  ],
  "meta": { ... }
}
```

### 6-7. Webhook API

```
POST /api/webhooks/ses

Headers:
- x-amz-sns-message-type: Notification
- x-amz-sns-topic-arn: arn:aws:sns:...

Body: SNS Message (SES Event)

Response: 200 OK
```

### 6-8. Unsubscribe API

```
GET /u/:token

Response: HTML page (配信停止完了画面)

処理:
1. tokenからcontact特定
2. unsubscribes追加
3. contacts.status → 'unsubscribed'
4. 完了ページ表示
```

---

## 7. 送信処理フロー

### 7-1. キャンペーンQueue化

```
1. POST /api/campaigns/:id/queue 呼び出し
2. filter_tag_ids から対象contacts抽出（status='active'のみ）
3. unsubscribes テーブルと突合、除外
4. 各contactに対してmessagesレコード生成
   - subject/body をcontactごとにレンダリング
   - 配信停止リンク追記
   - status = 'queued'
5. campaign.status → 'queued'
6. Workerに送信タスクを発行
```

### 7-2. Worker送信処理

```typescript
// 擬似コード
async function processQueue(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  const rateLimit = campaign.rate_limit_per_minute;
  const interval = 60000 / rateLimit;  // ms per message

  while (true) {
    // 停止チェック
    if (await isCampaignStopped(campaignId)) break;

    // 次のメッセージ取得
    const message = await getNextQueuedMessage(campaignId);
    if (!message) break;  // 完了

    // 送信
    const result = await sendViaSES(message);

    if (result.success) {
      await updateMessageStatus(message.id, 'sent', result.messageId);
    } else {
      await handleSendFailure(message, result.error);
    }

    // 自動停止チェック
    await checkAutoStopConditions(campaignId);

    // レート制限
    await sleep(interval);
  }

  await updateCampaignStatus(campaignId, 'completed');
}
```

### 7-3. リトライ戦略

| リトライ | 待機時間 | 条件 |
|---------|---------|------|
| 1回目 | 30秒 | SES一時エラー |
| 2回目 | 2分 | SES一時エラー |
| 3回目 | 10分 | SES一時エラー |
| 失敗 | - | 3回失敗後、status='failed' |

### 7-4. 配信停止リンク生成

```typescript
function generateUnsubscribeUrl(contact: Contact, campaignId: string): string {
  const token = generateSecureToken(contact.email, campaignId);

  // tokenをDBに保存
  await db.unsubscribes.upsert({
    email: contact.email,
    contact_id: contact.id,
    campaign_id: campaignId,
    token: token
  });

  return `${APP_URL}/u/${token}`;
}

// 本文末尾に追加
finalBody += `\n\n---\n配信停止はこちら: ${unsubscribeUrl}`;
```

---

## 8. 画面仕様

### 8-1. ダッシュボード（/dashboard）

**表示内容**:
- 今日の送信数
- 直近7日の配信状況サマリー
- 進行中キャンペーン一覧
- 最近のバウンス/苦情アラート

### 8-2. キャンペーン一覧（/dashboard/campaigns）

**表示内容**:
- キャンペーン一覧（ステータスバッジ付き）
- フィルター: ステータス、日付範囲
- 各行: 名前、送信数、到達率、作成日時

### 8-3. キャンペーン作成ウィザード（/dashboard/campaigns/new）

**ステップ**:

1. **テンプレート選択**
   - セミナー案内 / 無料登録案内 選択
   - プリセット or カスタムテンプレート選択

2. **情報入力**
   - テンプレートタイプに応じたフォーム
   - リアルタイムプレビュー

3. **宛先選択**
   - 全連絡先 or タグ絞り込み
   - 対象件数表示

4. **件名選択**
   - 候補から選択（ラジオボタン）

5. **送信設定**
   - 今すぐ or 予約
   - 送信者名・メールアドレス

6. **確認・送信**
   - 全設定サマリー
   - テスト送信ボタン
   - 送信開始ボタン

### 8-4. キャンペーン詳細（/dashboard/campaigns/:id）

**表示内容**:
- ステータス表示（大きく目立つ）
- 進捗バー（送信済み / 全体）
- 統計: 送信・到達・バウンス・苦情
- アクションボタン: 一時停止 / 再開 / 停止
- メッセージ一覧タブ（フィルター可能）
- 自動停止理由（発生した場合）

### 8-5. 連絡先（/dashboard/contacts）

**機能**:
- CSVインポート
- 一覧表示（検索・フィルター）
- タグ付け（一括・個別）
- ステータス確認
- 履歴閲覧（events参照）

### 8-6. タグ管理（/dashboard/tags）

**機能**:
- タグ一覧
- 作成・編集・削除
- 連絡先数表示

### 8-7. テンプレート（/dashboard/templates）

**機能**:
- プリセット一覧（編集不可、複製可）
- カスタムテンプレート一覧
- 作成・編集・削除
- プレビュー

### 8-8. 設定（/dashboard/settings）

**機能**:
- 送信者情報設定
- 送信レート設定（adminのみ）
- メール送信プロバイダ設定
- 通知設定

---

## 9. 権限（RBAC）

| 機能 | admin | editor | viewer |
|-----|-------|--------|--------|
| キャンペーン閲覧 | ○ | ○ | ○ |
| キャンペーン作成 | ○ | ○ | × |
| キャンペーン送信 | ○ | ○ | × |
| キャンペーン一時停止 | ○ | ○ | × |
| キャンペーン再開 | ○ | × | × |
| キャンペーン停止 | ○ | × | × |
| 連絡先インポート | ○ | ○ | × |
| 連絡先編集 | ○ | ○ | × |
| テンプレート管理 | ○ | ○ | × |
| 送信設定変更 | ○ | × | × |
| ユーザー管理 | ○ | × | × |

---

## 10. KPI/レポート（MVP最小）

### 10-1. キャンペーンレベル

| 指標 | 説明 |
|-----|------|
| 送信数 | messages where status in ('sent','delivered','bounced','complained') |
| 到達数 | messages where status = 'delivered' |
| バウンス数/率 | messages where status = 'bounced' |
| 苦情数/率 | messages where status = 'complained' |
| 失敗数 | messages where status = 'failed' |

### 10-2. 全体レベル（ダッシュボード）

| 指標 | 期間 |
|-----|------|
| 送信数 | 今日/7日/30日 |
| 平均到達率 | 7日/30日 |
| バウンス率推移 | 7日グラフ |
| 苦情率推移 | 7日グラフ |

### 10-3. 将来追加予定（MVP外）

- 開封率（Pixel Tracking）
- クリック率（Link Tracking）
- 配信時間帯別パフォーマンス

---

## 11. セキュリティ要件

### 11-1. 認証・認可

- Supabase Auth による認証
- Row Level Security (RLS) による data isolation
- JWT 有効期限: 1時間（リフレッシュトークン: 7日）

### 11-2. データ保護

- 通信: HTTPS必須
- DB: Supabase managed encryption at rest
- PII: email, first_name は最小限のみ保存

### 11-3. API保護

- Rate Limiting: 100 req/min per user
- Webhook: 署名検証必須（SES/SNS）
- CORS: 許可オリジン制限

---

## 12. 受け入れ基準

### 12-1. 機能要件（全て満たすこと）

- [ ] テンプレート2種（セミナー/無料登録）でキャンペーン作成→プレビュー→送信できる
- [ ] 連絡先CSVインポート + タグ付けができる
- [ ] テンプレート固定 + プレビューレンダリングが動作する
- [ ] キャンペーンキュー化（messages生成）が動作する
- [ ] SES経由でメール送信ができる
- [ ] SES Webhookでdelivery/bounce/complaintを受信・処理できる
- [ ] バウンス率/苦情率による自動停止が動作する
- [ ] バウンス/苦情/解除による自動除外が動作する
- [ ] 配信停止リンク（/u/:token）が動作する

### 12-2. 非機能要件

- [ ] 5,000通送信が20分以内に完了する（20通/分時）
- [ ] ダッシュボード表示が3秒以内
- [ ] 同時10ユーザーでの操作が問題なく動作する

### 12-3. 到達率要件

- [ ] Gmail/Outlookで迷惑メールに入らない（テスト10通中10通受信箱）
- [ ] バウンス率 < 5% の状態を維持できる設計
- [ ] SPF/DKIM/DMARC が正しく設定されている

---

## 13. 実装優先順位

### Phase 1: 基盤（Week 1-2）

1. DBスキーマ作成（Supabase Migration）
2. 認証・RLS設定
3. テンプレートシード投入
4. Contacts CRUD + CSVインポート

### Phase 2: コア機能（Week 3-4）

5. Tags管理
6. キャンペーン作成ウィザード
7. プレビュー機能
8. キュー化処理

### Phase 3: 送信機能（Week 5-6）

9. SES連携
10. Worker送信処理
11. Webhook受信・処理
12. 自動停止/自動除外ロジック

### Phase 4: 完成（Week 7-8）

13. 配信停止ページ
14. ダッシュボード・レポート
15. 権限管理
16. テスト・品質保証

---

## 14. 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=https://app.awiiin.com

# Email Provider
EMAIL_PROVIDER=ses  # ses | resend | sendgrid | mock

# SES
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_FROM_EMAIL=info@m.awiiin.com
SES_FROM_NAME=Awiiin

# Resend (fallback)
RESEND_API_KEY=

# Webhook Security
WEBHOOK_SECRET=
```

---

## 15. 用語集

| 用語 | 定義 |
|-----|------|
| Hard Bounce | 永続的な配信失敗（アドレス不存在等） |
| Soft Bounce | 一時的な配信失敗（メールボックス満杯等） |
| Complaint | 受信者による迷惑メール報告 |
| Unsubscribe | 配信停止リクエスト |
| SPF | Sender Policy Framework（送信ドメイン認証） |
| DKIM | DomainKeys Identified Mail（電子署名） |
| DMARC | Domain-based Message Authentication（ポリシー） |

---

**End of Document**
