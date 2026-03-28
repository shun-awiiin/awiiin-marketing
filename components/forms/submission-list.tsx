"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"
import type { StandaloneForm, StandaloneFormSubmission } from "@/lib/types/forms"

interface SubmissionListProps {
  form: StandaloneForm
  submissions: StandaloneFormSubmission[]
}

function getFieldColumns(form: StandaloneForm): { name: string; label: string }[] {
  return form.fields
    .filter((f) => f.type !== "hidden")
    .map((f) => ({ name: f.name, label: f.label || f.name }))
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

export function SubmissionList({ form, submissions }: SubmissionListProps) {
  const columns = getFieldColumns(form)

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">送信データがありません</h3>
          <p className="text-sm text-muted-foreground">
            フォームが送信されるとここに表示されます。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">送信日時</TableHead>
            {columns.map((col) => (
              <TableHead key={col.name} className="whitespace-nowrap">
                {col.label}
              </TableHead>
            ))}
            <TableHead className="whitespace-nowrap">IPアドレス</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => {
            const data = sub.form_data as Record<string, unknown>
            return (
              <TableRow key={sub.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(sub.submitted_at).toLocaleString("ja-JP")}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.name} className="max-w-[200px] truncate">
                    {formatCellValue(data[col.name])}
                  </TableCell>
                ))}
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {sub.ip_address || "-"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
