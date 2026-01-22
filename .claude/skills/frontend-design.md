# Frontend Design Skill

シンプルで操作性の高いUIを作るためのガイドライン。

## 基本原則

1. **少ないクリックで目的達成** - 3クリック以内で主要操作を完了
2. **情報の優先順位** - 重要な情報を上部・左側に配置
3. **一貫性** - 同じ操作は同じUIパターンで
4. **即座のフィードバック** - 操作結果をすぐに表示

## 技術スタック

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui (new-york スタイル)
- Lucide React アイコン

## よく使うコンポーネント

```tsx
// インポート
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

## カラー規則

| 状態 | 色 |
|------|-----|
| 成功・良好 | `green-500` |
| 警告・注意 | `yellow-500` |
| エラー・危険 | `red-500` |
| 無効・補助 | `muted-foreground` |

## レイアウト

```tsx
// ページ構造
<div className="space-y-6">
  {/* ヘッダー */}
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold">タイトル</h1>
    <Button><Plus className="mr-2 h-4 w-4" />新規作成</Button>
  </div>
  
  {/* コンテンツ */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {/* カード */}
  </div>
</div>
```

## UXパターン

### ローディング
```tsx
<Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />処理中...</Button>
```

### 空状態
```tsx
<div className="text-center py-8 text-muted-foreground">
  <p>データがありません</p>
</div>
```

### 確認ダイアログ
- 削除など破壊的操作には必ず確認を表示
- `AlertDialog` を使用

### トースト通知
```tsx
import { toast } from "sonner";
toast.success("保存しました");
toast.error("エラーが発生しました");
```

## 避けるべきこと

- 過度な装飾やアニメーション
- 1画面に情報を詰め込みすぎる
- 曖昧なボタンラベル（「OK」より「保存する」）
- 確認なしの破壊的操作
- モバイルで使いにくい小さなタップ領域

## 日本語テキスト

- ボタン: 「作成する」「保存」「削除」（動詞）
- 見出し: 「キャンペーン一覧」「設定」（名詞）
- エラー: 具体的に「メールアドレスの形式が正しくありません」
