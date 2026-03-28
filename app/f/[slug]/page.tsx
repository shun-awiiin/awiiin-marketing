"use client"

import { useState, useCallback, useEffect } from "react"
import { useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import type { FormField, FormSettings } from "@/lib/types/forms"

interface FormData {
  name: string
  fields: FormField[]
  settings: FormSettings
  style: Record<string, string>
}

type SubmitState = "idle" | "submitting" | "success" | "error"

export default function PublicFormPage() {
  const params = useParams()
  const slug = params.slug as string

  const [formData, setFormData] = useState<FormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/forms/public/${slug}/submit`, { method: "OPTIONS" })
        if (res.status === 405 || res.status === 404) {
          // OPTIONS not supported, try fetching form data via a GET-like approach
          // The form data is fetched from the public slug endpoint
        }
      } catch {
        // ignore
      }

      // Fetch form structure from a dedicated public endpoint
      // Since we only have the submit POST endpoint, we fetch the form data
      // by querying the slug directly
      try {
        const res = await fetch(`/api/forms/public/${slug}`)
        if (!res.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const { data } = await res.json()
        setFormData({
          name: data.name,
          fields: data.fields,
          settings: data.settings,
          style: data.style || {},
        })

        // Initialize default values
        const defaults: Record<string, unknown> = {}
        for (const field of data.fields as FormField[]) {
          if (field.defaultValue) {
            defaults[field.name] = field.defaultValue
          }
          if (field.type === "checkbox") {
            defaults[field.name] = defaults[field.name] || []
          }
        }
        setValues(defaults)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const updateValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const toggleCheckbox = useCallback((name: string, option: string) => {
    setValues((prev) => {
      const current = (prev[name] as string[]) || []
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option]
      return { ...prev, [name]: next }
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!formData) return
      setSubmitState("submitting")
      setErrorMessage("")

      // Collect UTM params from URL
      const urlParams = new URLSearchParams(window.location.search)
      const utmParams: Record<string, string> = {}
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        const val = urlParams.get(key)
        if (val) utmParams[key] = val
      }

      try {
        const res = await fetch(`/api/forms/public/${slug}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: values,
            utm_params: Object.keys(utmParams).length > 0 ? utmParams : undefined,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          setErrorMessage(err.error || "送信に失敗しました")
          setSubmitState("error")
          return
        }

        const { data } = await res.json()
        setSuccessMessage(data.message)
        setSubmitState("success")

        // Notify parent for iframe auto-resize
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: "mf-resize", slug, height: document.body.scrollHeight },
            "*"
          )
        }

        if (data.redirectUrl) {
          setTimeout(() => {
            window.location.href = data.redirectUrl
          }, 1500)
        }
      } catch {
        setErrorMessage("ネットワークエラーが発生しました")
        setSubmitState("error")
      }
    },
    [formData, slug, values]
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !formData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h1 className="mb-2 text-xl font-bold">フォームが見つかりません</h1>
          <p className="text-sm text-muted-foreground">
            このフォームは存在しないか、現在受付を停止しています。
          </p>
        </div>
      </div>
    )
  }

  if (submitState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="mx-auto max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
          <p className="text-lg font-medium">{successMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center p-4 pt-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-5 rounded-lg border bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold">{formData.name}</h1>

        {formData.fields.map((field) => (
          <PublicField
            key={field.id}
            field={field}
            value={values[field.name]}
            onChange={(v) => updateValue(field.name, v)}
            onToggleCheckbox={(opt) => toggleCheckbox(field.name, opt)}
          />
        ))}

        {submitState === "error" && errorMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={submitState === "submitting"}
        >
          {submitState === "submitting" && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {formData.settings.submitLabel}
        </Button>
      </form>
    </div>
  )
}

/* --------------------------------------------------------
 * PublicField - renders a single form field for submission
 * ------------------------------------------------------ */

interface PublicFieldProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  onToggleCheckbox: (option: string) => void
}

function PublicField({ field, value, onChange, onToggleCheckbox }: PublicFieldProps) {
  if (field.type === "hidden") {
    return (
      <input type="hidden" name={field.name} value={String(field.defaultValue || "")} />
    )
  }

  const labelElement = (
    <Label htmlFor={field.id}>
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  )

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-2">
          {labelElement}
          <Textarea
            id={field.id}
            name={field.name}
            placeholder={field.placeholder}
            required={field.required}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
          />
        </div>
      )

    case "select":
      return (
        <div className="space-y-2">
          {labelElement}
          <Select
            value={String(value || "")}
            onValueChange={(v) => onChange(v)}
            required={field.required}
          >
            <SelectTrigger id={field.id}>
              <SelectValue placeholder={field.placeholder || "選択してください"} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    case "radio":
      return (
        <div className="space-y-2">
          {labelElement}
          <RadioGroup
            value={String(value || "")}
            onValueChange={(v) => onChange(v)}
            required={field.required}
          >
            {(field.options || []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                <Label htmlFor={`${field.id}-${opt}`} className="font-normal">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )

    case "checkbox": {
      const checked = (value as string[]) || []
      if (field.options && field.options.length > 0) {
        return (
          <div className="space-y-2">
            {labelElement}
            {field.options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-${opt}`}
                  checked={checked.includes(opt)}
                  onCheckedChange={() => onToggleCheckbox(opt)}
                />
                <Label htmlFor={`${field.id}-${opt}`} className="font-normal">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        )
      }
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={Boolean(value)}
            onCheckedChange={(c) => onChange(c)}
          />
          <Label htmlFor={field.id} className="font-normal">
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
        </div>
      )
    }

    default:
      return (
        <div className="space-y-2">
          {labelElement}
          <Input
            id={field.id}
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            required={field.required}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )
  }
}
