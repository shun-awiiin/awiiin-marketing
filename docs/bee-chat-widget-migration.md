# Bee チャットウィジェット置き換え手順書

## 概要

現在 Bee（shipping-agency）に導入されている **HubSpot チャットウィジェット** を、自社開発の **MailFlow チャットウィジェット** に置き換える手順です。

変更量は最小限（HTML 2行の差し替え）で完了します。

---

## 現在の実装（HubSpot）

**ファイル:** `app/index.html`（および `app/dist/index.html`）

```html
<!-- Start of HubSpot Embed Code -->
<script type="text/javascript" id="hs-script-loader" async defer src="//js.hs-scripts.com/20520729.js"></script>
<!-- End of HubSpot Embed Code -->
```

---

## 新しい実装（MailFlow チャットウィジェット）

### 置き換えるコード

上記の HubSpot コードを **削除** し、以下に **置き換えて** ください：

```html
<!-- Start of MailFlow Chat Widget -->
<script
  src="https://YOUR_MAILFLOW_DOMAIN/chat-widget.js"
  data-widget-id="c0fa5216-6a6d-46fd-bfbe-464d26b2f307"
  data-position="bottom-right"
  data-color="#F8A826"
  async
  defer
></script>
<!-- End of MailFlow Chat Widget -->
```

> **注意:** `YOUR_MAILFLOW_DOMAIN` は MailFlow アプリのデプロイ先ドメインに置き換えてください。
> ローカル開発時は `http://localhost:3000` を使用します。

### ローカル開発用（テスト確認用）

```html
<script
  src="http://localhost:3000/chat-widget.js"
  data-widget-id="c0fa5216-6a6d-46fd-bfbe-464d26b2f307"
  data-position="bottom-right"
  data-color="#F8A826"
  async
  defer
></script>
```

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---|---|
| `app/index.html` | HubSpot スクリプト → MailFlow スクリプトに差し替え |
| `app/dist/index.html` | 同上（ビルド時に自動反映される場合は不要） |

---

## 差し替え手順（ステップバイステップ）

### Step 1: `app/index.html` を開く

23〜25行目付近にある以下のコードを探す：

```html
<!-- Start of HubSpot Embed Code -->
<script type="text/javascript" id="hs-script-loader" async defer src="//js.hs-scripts.com/20520729.js"></script>
<!-- End of HubSpot Embed Code -->
```

### Step 2: 上記を以下に置き換える

```html
<!-- Start of MailFlow Chat Widget -->
<script
  src="https://YOUR_MAILFLOW_DOMAIN/chat-widget.js"
  data-widget-id="c0fa5216-6a6d-46fd-bfbe-464d26b2f307"
  data-position="bottom-right"
  data-color="#F8A826"
  async
  defer
></script>
<!-- End of MailFlow Chat Widget -->
```

### Step 3: 動作確認

1. ページをリロード
2. 右下にオレンジ色のチャットアイコンが表示されることを確認
3. アイコンをクリックしてチャットパネルが開くことを確認
4. メールアドレスと名前を入力してメッセージ送信できることを確認

### Step 4: MailFlow ダッシュボードで受信確認

- MailFlow の `/dashboard/chat` でメッセージが受信されていることを確認
- 送信者のメールアドレスが `/dashboard/contacts` に自動登録されていることを確認

---

## ウィジェットの設定パラメータ

| パラメータ | 値 | 説明 |
|---|---|---|
| `data-widget-id` | `c0fa5216-6a6d-46fd-bfbe-464d26b2f307` | ウィジェット識別ID（変更不要） |
| `data-position` | `bottom-right` | 表示位置（`bottom-right` or `bottom-left`） |
| `data-color` | `#F8A826` | テーマカラー（Bee のブランドカラー） |

---

## HubSpot との機能比較

| 機能 | HubSpot | MailFlow |
|---|---|---|
| リアルタイムチャット | あり | あり |
| 訪問者のメール取得 | あり | あり（必須設定可能） |
| コンタクト自動登録 | HubSpot CRM | MailFlow コンタクトリスト |
| チャット履歴 | HubSpot 管理画面 | MailFlow `/dashboard/chat` |
| タイムライン紐付け | HubSpot CRM | MailFlow コンタクト詳細 |
| 自社管理 | 不可（外部サービス） | 完全自社管理 |
| 月額費用 | HubSpot 料金 | なし（自社インフラ） |

---

## 注意事項

- HubSpot のスクリプトを残したまま MailFlow のスクリプトを追加すると、チャットアイコンが2つ表示されます。必ず HubSpot 側を **削除** してから置き換えてください。
- `chat-widget.js` は外部依存なし（バニラ JS）のため、Vue.js との競合はありません。
- ウィジェットの色・挨拶メッセージ等の変更は MailFlow の `/dashboard/chat/settings` から行えます。
