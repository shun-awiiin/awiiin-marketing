"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MoreHorizontal, Pencil, Trash2, ClipboardList, Code } from "lucide-react"
import type { StandaloneForm } from "@/lib/types/forms"
import { FormEmbedDialog } from "./form-embed-dialog"
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "下書き", variant: "secondary" },
  active: { label: "公開中", variant: "default" },
  archived: { label: "アーカイブ", variant: "outline" },
}

interface FormListProps {
  forms: StandaloneForm[]
}

export function FormList({ forms: initialForms }: FormListProps) {
  const orgFetch = useOrgFetch();
  const router = useRouter()
  const [forms, setForms] = useState(initialForms)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [embedTarget, setEmbedTarget] = useState<StandaloneForm | null>(null)

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return

    const res = await orgFetch(`/api/forms/${deleteTarget}`, { method: "DELETE" })
    if (res.ok) {
      setForms((prev) => prev.filter((f) => f.id !== deleteTarget))
    }
    setDeleteTarget(null)
  }, [deleteTarget])

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <ClipboardList className="mb-4 size-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">フォームがありません</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          最初のフォームを作成して、リード獲得を始めましょう。
        </p>
        <Button asChild>
          <Link href="/dashboard/forms/new">フォームを作成</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>フォーム名</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="text-right">送信数</TableHead>
            <TableHead>作成日</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {forms.map((form) => {
            const badge = STATUS_BADGES[form.status] || STATUS_BADGES.draft
            return (
              <TableRow key={form.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/forms/${form.id}`}
                    className="font-medium hover:underline"
                  >
                    {form.name}
                  </Link>
                  {form.description && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {form.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {form.submission_count}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(form.created_at).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/forms/${form.id}`)}
                      >
                        <Pencil className="mr-2 size-4" />
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/dashboard/forms/${form.id}/submissions`)
                        }
                      >
                        <ClipboardList className="mr-2 size-4" />
                        送信一覧
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEmbedTarget(form)}>
                        <Code className="mr-2 size-4" />
                        埋め込みコード
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(form.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>フォームを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。フォームとすべての送信データが削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {embedTarget && (
        <FormEmbedDialog
          form={embedTarget}
          open={!!embedTarget}
          onOpenChange={() => setEmbedTarget(null)}
        />
      )}
    </>
  )
}
