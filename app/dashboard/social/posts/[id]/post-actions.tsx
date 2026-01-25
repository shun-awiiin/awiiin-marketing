"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface PostActionsProps {
  postId: string
  canEdit: boolean
  canPublish: boolean
}

export function PostActions({ postId, canEdit, canPublish }: PostActionsProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handlePublish() {
    try {
      setPublishing(true)
      const response = await fetch(`/api/social/posts/${postId}/publish`, {
        method: "POST",
      })
      const result = await response.json()

      if (result.success) {
        if (result.data.allSuccessful) {
          toast.success("投稿を公開しました")
        } else {
          const failedCount = result.data.results.filter((r: { success: boolean }) => !r.success).length
          toast.warning(`一部のチャンネルで投稿に失敗しました (${failedCount}件)`)
        }
        router.refresh()
      } else {
        toast.error(result.error || "公開に失敗しました")
      }
    } catch {
      toast.error("公開に失敗しました")
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true)
      const response = await fetch(`/api/social/posts/${postId}`, {
        method: "DELETE",
      })
      const result = await response.json()

      if (result.success) {
        toast.success("投稿を削除しました")
        router.push("/dashboard/social/posts")
        router.refresh()
      } else {
        toast.error(result.error || "削除に失敗しました")
      }
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canPublish && (
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            今すぐ公開
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <DropdownMenuItem onClick={() => router.push(`/dashboard/social/posts/${postId}/edit`)}>
                <Edit className="mr-2 size-4" />
                編集
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>投稿を削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。投稿とすべてのチャンネル設定が削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  削除中...
                </>
              ) : (
                "削除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
