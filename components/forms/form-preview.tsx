"use client"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FormField, FormSettings } from "@/lib/types/forms"

interface FormPreviewProps {
  fields: FormField[]
  settings: FormSettings
}

export function FormPreview({ fields, settings }: FormPreviewProps) {
  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            フィールドを追加するとプレビューが表示されます。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg">プレビュー</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => e.preventDefault()}
        >
          {fields.map((field) => (
            <PreviewField key={field.id} field={field} />
          ))}
          <Button type="button" className="w-full">
            {settings.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PreviewField({ field }: { field: FormField }) {
  if (field.type === "hidden") return null

  const labelElement = (
    <Label>
      {field.label || "(ラベル未設定)"}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  )

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-2">
          {labelElement}
          <Textarea
            placeholder={field.placeholder}
            rows={3}
            disabled
          />
        </div>
      )

    case "select":
      return (
        <div className="space-y-2">
          {labelElement}
          <Select disabled>
            <SelectTrigger>
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
          <RadioGroup disabled>
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

    case "checkbox":
      return (
        <div className="space-y-2">
          {labelElement}
          {(field.options || []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox id={`${field.id}-${opt}`} disabled />
              <Label htmlFor={`${field.id}-${opt}`} className="font-normal">
                {opt}
              </Label>
            </div>
          ))}
          {(!field.options || field.options.length === 0) && (
            <div className="flex items-center gap-2">
              <Checkbox disabled />
              <Label className="font-normal">
                {field.placeholder || field.label || "チェック"}
              </Label>
            </div>
          )}
        </div>
      )

    default:
      return (
        <div className="space-y-2">
          {labelElement}
          <Input
            type={field.type}
            placeholder={field.placeholder}
            disabled
          />
        </div>
      )
  }
}
