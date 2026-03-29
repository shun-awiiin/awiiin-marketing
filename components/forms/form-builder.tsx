"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import type { FormField, FormFieldType, FormSettings } from "@/lib/types/forms"

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "テキスト" },
  { value: "email", label: "メール" },
  { value: "tel", label: "電話番号" },
  { value: "textarea", label: "テキストエリア" },
  { value: "select", label: "セレクト" },
  { value: "radio", label: "ラジオ" },
  { value: "checkbox", label: "チェックボックス" },
  { value: "hidden", label: "非表示" },
]

const HAS_OPTIONS: FormFieldType[] = ["select", "radio", "checkbox"]

interface FormBuilderProps {
  name: string
  description: string
  fields: FormField[]
  settings: FormSettings
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onFieldsChange: (fields: FormField[]) => void
  onSettingsChange: (settings: FormSettings) => void
}

export function FormBuilder({
  name,
  description,
  fields,
  settings,
  onNameChange,
  onDescriptionChange,
  onFieldsChange,
  onSettingsChange,
}: FormBuilderProps) {
  const addField = useCallback(() => {
    const id = crypto.randomUUID()
    const newField: FormField = {
      id,
      type: "text",
      label: "",
      name: `field_${fields.length + 1}`,
      placeholder: "",
      required: false,
    }
    onFieldsChange([...fields, newField])
  }, [fields, onFieldsChange])

  const removeField = useCallback(
    (id: string) => {
      onFieldsChange(fields.filter((f) => f.id !== id))
    },
    [fields, onFieldsChange]
  )

  const updateField = useCallback(
    (id: string, updates: Partial<FormField>) => {
      onFieldsChange(
        fields.map((f) => (f.id === id ? { ...f, ...updates } : f))
      )
    },
    [fields, onFieldsChange]
  )

  const moveField = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction
      if (target < 0 || target >= fields.length) return
      const next = [...fields]
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      onFieldsChange(next)
    },
    [fields, onFieldsChange]
  )

  const updateSetting = useCallback(
    <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => {
      onSettingsChange({ ...settings, [key]: value })
    },
    [settings, onSettingsChange]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Form Info + Fields */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">フォーム名</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="お問い合わせフォーム"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-desc">説明</Label>
              <Textarea
                id="form-desc"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="フォームの説明（任意）"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>フィールド</CardTitle>
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="mr-1 size-4" />
              追加
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                フィールドを追加してください。
              </p>
            )}
            {fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                onUpdate={(updates) => updateField(field.id, updates)}
                onRemove={() => removeField(field.id)}
                onMove={(dir) => moveField(index, dir)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Right: Settings */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>フォーム設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="submit-label">送信ボタンのラベル</Label>
              <Input
                id="submit-label"
                value={settings.submitLabel}
                onChange={(e) => updateSetting("submitLabel", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="success-message">送信完了メッセージ</Label>
              <Textarea
                id="success-message"
                value={settings.successMessage}
                onChange={(e) =>
                  updateSetting("successMessage", e.target.value)
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redirect-url">リダイレクトURL（任意）</Label>
              <Input
                id="redirect-url"
                type="url"
                value={settings.redirectUrl || ""}
                onChange={(e) =>
                  updateSetting("redirectUrl", e.target.value || null)
                }
                placeholder="https://example.com/thanks"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notify-email">通知先メール（任意・カンマ区切りで複数可）</Label>
              <Input
                id="notify-email"
                type="text"
                value={settings.notifyEmail || ""}
                onChange={(e) =>
                  updateSetting("notifyEmail", e.target.value || null)
                }
                placeholder="user1@example.com, user2@example.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>自動返信</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-reply-toggle">自動返信を有効にする</Label>
              <Switch
                id="auto-reply-toggle"
                checked={settings.autoReplyEnabled}
                onCheckedChange={(checked) =>
                  updateSetting("autoReplyEnabled", checked)
                }
              />
            </div>
            {settings.autoReplyEnabled && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="auto-reply-subject">件名</Label>
                  <Input
                    id="auto-reply-subject"
                    value={settings.autoReplySubject}
                    onChange={(e) =>
                      updateSetting("autoReplySubject", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-reply-body">本文</Label>
                  <Textarea
                    id="auto-reply-body"
                    value={settings.autoReplyBody || ""}
                    onChange={(e) =>
                      updateSetting("autoReplyBody", e.target.value || null)
                    }
                    rows={4}
                    placeholder="お問い合わせありがとうございます。..."
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------
 * Field Editor (sub-component)
 * ------------------------------------------------------ */

interface FieldEditorProps {
  field: FormField
  index: number
  total: number
  onUpdate: (updates: Partial<FormField>) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

function FieldEditor({
  field,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: FieldEditorProps) {
  const showOptions = HAS_OPTIONS.includes(field.type)

  const handleOptionsChange = (text: string) => {
    onUpdate({ options: text.split("\n").filter(Boolean) })
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          #{index + 1}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">ラベル</Label>
          <Input
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="氏名"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">フィールド名</Label>
          <Input
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="name"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">タイプ</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onUpdate({ type: v as FormFieldType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">プレースホルダー</Label>
          <Input
            value={field.placeholder || ""}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={field.required}
          onCheckedChange={(checked) => onUpdate({ required: checked })}
        />
        <Label className="text-xs">必須</Label>
      </div>

      {showOptions && (
        <div className="space-y-1">
          <Label className="text-xs">選択肢（1行に1つ）</Label>
          <Textarea
            value={(field.options || []).join("\n")}
            onChange={(e) => handleOptionsChange(e.target.value)}
            rows={3}
            placeholder={"オプション1\nオプション2\nオプション3"}
          />
        </div>
      )}
    </div>
  )
}
