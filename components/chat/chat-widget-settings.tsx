"use client"

import { useState, useCallback, useMemo } from "react"
import { Plus, Copy, Check, Trash2, Settings2, Code, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { ChatWidget } from "@/lib/types/chat"
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

interface ChatWidgetSettingsProps {
  widgets: ChatWidget[]
  onRefresh: () => void
}

function generateEmbedCode(widget: ChatWidget): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `<script
  src="${origin}/chat-widget.js"
  data-widget-id="${widget.id}"
  data-position="${widget.settings.position}"
  data-color="${widget.settings.primaryColor}"
  defer
></script>`
}

export function ChatWidgetSettings({
  widgets,
  onRefresh,
}: ChatWidgetSettingsProps) {
  const orgFetch = useOrgFetch();
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Create form state
  const [newName, setNewName] = useState("")
  const [newGreeting, setNewGreeting] = useState(
    "こんにちは！何かお手伝いできることはありますか？"
  )
  const [newColor, setNewColor] = useState("#2563eb")
  const [newPosition, setNewPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right"
  )
  const [newDomains, setNewDomains] = useState("")
  const [newRequireEmail, setNewRequireEmail] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editGreeting, setEditGreeting] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editPosition, setEditPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right"
  )
  const [editDomains, setEditDomains] = useState("")
  const [editRequireEmail, setEditRequireEmail] = useState(false)
  const [editPlaceholder, setEditPlaceholder] = useState("")
  const [editOfflineMsg, setEditOfflineMsg] = useState("")

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await orgFetch("/api/chat/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          settings: {
            position: newPosition,
            primaryColor: newColor,
            greeting: newGreeting,
            placeholder: "メッセージを入力...",
            offlineMessage:
              "現在オフラインです。メールアドレスを残していただければ、後ほどご連絡いたします。",
            requireEmail: newRequireEmail,
          },
          allowed_domains: newDomains
            .split("\n")
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      })
      if (res.ok) {
        setNewName("")
        setNewGreeting("こんにちは！何かお手伝いできることはありますか？")
        setNewColor("#2563eb")
        setNewPosition("bottom-right")
        setNewDomains("")
        setNewRequireEmail(false)
        onRefresh()
      }
    } catch {
      // Network error
    } finally {
      setCreating(false)
    }
  }, [newName, newPosition, newColor, newGreeting, newRequireEmail, newDomains, onRefresh])

  const startEditing = useCallback((widget: ChatWidget) => {
    setEditingId(widget.id)
    setEditName(widget.name)
    setEditGreeting(widget.settings.greeting)
    setEditColor(widget.settings.primaryColor)
    setEditPosition(widget.settings.position)
    setEditDomains(widget.allowed_domains.join("\n"))
    setEditRequireEmail(widget.settings.requireEmail)
    setEditPlaceholder(widget.settings.placeholder)
    setEditOfflineMsg(widget.settings.offlineMessage)
  }, [])

  const handleUpdate = useCallback(async () => {
    if (!editingId || !editName.trim()) return
    setSaving(true)
    try {
      const res = await orgFetch(`/api/chat/widgets/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          settings: {
            position: editPosition,
            primaryColor: editColor,
            greeting: editGreeting,
            placeholder: editPlaceholder,
            offlineMessage: editOfflineMsg,
            requireEmail: editRequireEmail,
          },
          allowed_domains: editDomains
            .split("\n")
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      })
      if (res.ok) {
        setEditingId(null)
        onRefresh()
      }
    } catch {
      // Network error
    } finally {
      setSaving(false)
    }
  }, [
    editingId,
    editName,
    editPosition,
    editColor,
    editGreeting,
    editPlaceholder,
    editOfflineMsg,
    editRequireEmail,
    editDomains,
    onRefresh,
  ])

  const handleToggleActive = useCallback(
    async (widget: ChatWidget) => {
      try {
        await orgFetch(`/api/chat/widgets/${widget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !widget.is_active }),
        })
        onRefresh()
      } catch {
        // Network error
      }
    },
    [onRefresh]
  )

  const handleDelete = useCallback(
    async (widgetId: string) => {
      try {
        await orgFetch(`/api/chat/widgets/${widgetId}`, { method: "DELETE" })
        onRefresh()
      } catch {
        // Network error
      }
    },
    [onRefresh]
  )

  const handleCopyCode = useCallback((widget: ChatWidget) => {
    const code = generateEmbedCode(widget)
    navigator.clipboard.writeText(code)
    setCopiedId(widget.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  return (
    <div className="space-y-6">
      {/* Create New Widget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            新しいウィジェットを作成
          </CardTitle>
          <CardDescription>
            外部サイトに埋め込めるチャットウィジェットを作成します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="widget-name">ウィジェット名</Label>
              <Input
                id="widget-name"
                placeholder="例: メインサイト用"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="widget-color">テーマカラー</Label>
              <div className="flex gap-2">
                <Input
                  id="widget-color"
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-greeting">挨拶メッセージ</Label>
            <Textarea
              id="widget-greeting"
              value={newGreeting}
              onChange={(e) => setNewGreeting(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>表示位置</Label>
              <Select
                value={newPosition}
                onValueChange={(v) =>
                  setNewPosition(v as "bottom-right" | "bottom-left")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">右下</SelectItem>
                  <SelectItem value="bottom-left">左下</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={newRequireEmail}
                onCheckedChange={setNewRequireEmail}
              />
              <Label>メールアドレスを必須にする</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-domains">
              許可ドメイン（1行に1つ、空欄で全許可）
            </Label>
            <Textarea
              id="widget-domains"
              placeholder={"example.com\nwww.example.com"}
              value={newDomains}
              onChange={(e) => setNewDomains(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? "作成中..." : "ウィジェットを作成"}
          </Button>
        </CardContent>
      </Card>

      {/* Widget List */}
      {widgets.map((widget) => (
        <Card key={widget.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">{widget.name}</CardTitle>
                <Badge variant={widget.is_active ? "default" : "secondary"}>
                  {widget.is_active ? "有効" : "無効"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(widget)}
                >
                  {widget.is_active ? "無効にする" : "有効にする"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => startEditing(widget)}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>ウィジェットを削除</DialogTitle>
                      <DialogDescription>
                        「{widget.name}」を削除しますか？この操作は取り消せません。
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(widget.id)}
                      >
                        削除する
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">カラー: </span>
                <span
                  className="inline-block w-4 h-4 rounded align-middle mr-1"
                  style={{ backgroundColor: widget.settings.primaryColor }}
                />
                {widget.settings.primaryColor}
              </div>
              <div>
                <span className="text-muted-foreground">位置: </span>
                {widget.settings.position === "bottom-right" ? "右下" : "左下"}
              </div>
              <div>
                <span className="text-muted-foreground">メール必須: </span>
                {widget.settings.requireEmail ? "はい" : "いいえ"}
              </div>
            </div>

            <Separator />

            {/* Embed Code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  埋め込みコード
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(widget)}
                >
                  {copiedId === widget.id ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      コピー
                    </>
                  )}
                </Button>
              </div>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                <code>{generateEmbedCode(widget)}</code>
              </pre>
            </div>

            <Separator />

            {/* Live Preview */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                プレビュー
              </Label>
              <WidgetPreview widget={widget} />
            </div>
          </CardContent>
        </Card>
      ))}

      {widgets.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>ウィジェットがまだありません</p>
          <p className="text-sm mt-1">上のフォームから作成してください</p>
        </div>
      )}

      {/* Edit Dialog - includes preview */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ウィジェットを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ウィジェット名</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>テーマカラー</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>挨拶メッセージ</Label>
              <Textarea
                value={editGreeting}
                onChange={(e) => setEditGreeting(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>プレースホルダー</Label>
              <Input
                value={editPlaceholder}
                onChange={(e) => setEditPlaceholder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>オフラインメッセージ</Label>
              <Textarea
                value={editOfflineMsg}
                onChange={(e) => setEditOfflineMsg(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>表示位置</Label>
                <Select
                  value={editPosition}
                  onValueChange={(v) =>
                    setEditPosition(v as "bottom-right" | "bottom-left")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">右下</SelectItem>
                    <SelectItem value="bottom-left">左下</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={editRequireEmail}
                  onCheckedChange={setEditRequireEmail}
                />
                <Label>メールアドレス必須</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>許可ドメイン（1行に1つ）</Label>
              <Textarea
                value={editDomains}
                onChange={(e) => setEditDomains(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving || !editName.trim()}
            >
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WidgetPreview({ widget }: { widget: ChatWidget }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const color = widget.settings.primaryColor

  return (
    <div className="relative rounded-lg border bg-gradient-to-br from-slate-800 to-slate-900 p-6" style={{ minHeight: 460 }}>
      {/* Panel — HubSpot style */}
      {previewOpen && (
        <div
          className="absolute right-6 bottom-20 w-[320px] rounded-2xl bg-white shadow-2xl overflow-hidden"
          style={{ maxHeight: 400 }}
        >
          {/* Header */}
          <div
            className="px-4 py-3.5 text-white flex items-center justify-between"
            style={{ background: color }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white/30 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                {widget.name.charAt(0)}
              </div>
              <div className="text-sm font-semibold">{widget.name}</div>
            </div>
            <button
              className="text-white/70 hover:text-white transition-colors"
              onClick={() => setPreviewOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body with welcome bubble */}
          <div className="bg-[#f5f5f5] p-4" style={{ minHeight: 160 }}>
            <div className="flex gap-2 items-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 border-2 border-white shadow-sm"
                style={{ background: color }}
              >
                {widget.name.charAt(0)}
              </div>
              <div className="bg-white rounded-xl rounded-bl-sm px-3 py-2.5 text-xs text-gray-700 leading-relaxed shadow-sm whitespace-pre-wrap max-w-[80%]">
                {widget.settings.greeting}
              </div>
            </div>
          </div>

          {/* Intro form */}
          <div className="p-3 bg-white border-t space-y-2">
            <div className="text-[11px] text-gray-500 font-medium">お問い合わせ内容をご入力ください</div>
            <div>
              <div className="text-[10px] text-gray-400 font-semibold mb-0.5">お名前</div>
              <div className="border rounded-lg px-2.5 py-1.5 text-[11px] text-gray-400 bg-gray-50">山田 太郎</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 font-semibold mb-0.5">メールアドレス</div>
              <div className="border rounded-lg px-2.5 py-1.5 text-[11px] text-gray-400 bg-gray-50">you@example.com</div>
            </div>
          </div>

          {/* Footer input */}
          <div className="px-3 py-2.5 border-t bg-white flex gap-2 items-center">
            <div className="flex-1 border rounded-full px-3 py-2 text-[11px] text-gray-400 bg-gray-50">
              {widget.settings.placeholder || "何でもご依頼ください..."}
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ background: color }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        className="absolute right-6 bottom-6 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
        style={{ background: color }}
        onClick={() => setPreviewOpen(!previewOpen)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  )
}
