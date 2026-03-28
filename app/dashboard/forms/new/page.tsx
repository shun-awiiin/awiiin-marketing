"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FormBuilder } from "@/components/forms/form-builder"
import { FormPreview } from "@/components/forms/form-preview"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import type { FormField, FormSettings } from "@/lib/types/forms"

const DEFAULT_SETTINGS: FormSettings = {
  submitLabel: "送信",
  successMessage: "送信が完了しました。ありがとうございます。",
  redirectUrl: null,
  notifyEmail: null,
  autoReplyEnabled: false,
  autoReplySubject: "お問い合わせありがとうございます",
  autoReplyBody: null,
  autoReplyTemplateId: null,
  scenarioId: null,
  tagIds: [],
}

export default function NewFormPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<FormField[]>([])
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, fields, settings }),
      })
      if (res.ok) {
        const { data } = await res.json()
        router.push(`/dashboard/forms/${data.id}`)
      }
    } finally {
      setSaving(false)
    }
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
            <h1 className="text-2xl font-bold tracking-tight">新規フォーム</h1>
            <p className="text-muted-foreground">
              フォームのフィールドと設定を構成します。
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="mr-2 size-4" />
          {saving ? "保存中..." : "保存"}
        </Button>
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
    </div>
  )
}
