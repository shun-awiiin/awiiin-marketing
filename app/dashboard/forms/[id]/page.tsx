"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { FormBuilder } from "@/components/forms/form-builder"
import { FormPreview } from "@/components/forms/form-preview"
import { FormEmbedDialog } from "@/components/forms/form-embed-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, Code, ClipboardList, Loader2 } from "lucide-react"
import Link from "next/link"
import type { StandaloneForm, FormField, FormSettings, FormStatus } from "@/lib/types/forms"

const STATUS_OPTIONS: { value: FormStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "active", label: "公開中" },
  { value: "archived", label: "アーカイブ" },
]

export default function EditFormPage() {
  const params = useParams()
  const router = useRouter()
  const formId = params.id as string

  const [form, setForm] = useState<StandaloneForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [embedOpen, setEmbedOpen] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<FormStatus>("draft")
  const [fields, setFields] = useState<FormField[]>([])
  const [settings, setSettings] = useState<FormSettings | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/forms/${formId}`)
      if (!res.ok) {
        router.push("/dashboard/forms")
        return
      }
      const { data } = await res.json()
      setForm(data)
      setName(data.name)
      setDescription(data.description || "")
      setStatus(data.status)
      setFields(data.fields)
      setSettings(data.settings)
      setLoading(false)
    }
    load()
  }, [formId, router])

  const handleSave = useCallback(async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          status,
          fields,
          settings,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setForm(data)
      }
    } finally {
      setSaving(false)
    }
  }, [formId, name, description, status, fields, settings])

  if (loading || !form || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/forms">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              フォーム編集
            </h1>
            <p className="text-sm text-muted-foreground">ID: {formId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as FormStatus)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/forms/${formId}/submissions`}>
              <ClipboardList className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setEmbedOpen(true)}>
            <Code className="size-4" />
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            <Save className="mr-2 size-4" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">送信数: {form.submission_count}</Badge>
        <span>作成日: {new Date(form.created_at).toLocaleDateString("ja-JP")}</span>
      </div>

      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder">ビルダー</TabsTrigger>
          <TabsTrigger value="preview">プレビュー</TabsTrigger>
        </TabsList>
        <TabsContent value="builder">
          <FormBuilder
            name={name}
            description={description}
            fields={fields}
            settings={settings}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onFieldsChange={setFields}
            onSettingsChange={setSettings}
          />
        </TabsContent>
        <TabsContent value="preview">
          <FormPreview fields={fields} settings={settings} />
        </TabsContent>
      </Tabs>

      {embedOpen && (
        <FormEmbedDialog
          form={form}
          open={embedOpen}
          onOpenChange={setEmbedOpen}
        />
      )}
    </div>
  )
}
