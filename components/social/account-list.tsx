"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Loader2, Plus, Trash2, RefreshCw, ExternalLink, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import type { SocialProvider, SocialAccountStatus } from "@/lib/social/types"

interface SocialAccountDisplay {
  id: string
  provider: SocialProvider
  providerAccountId: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  status: SocialAccountStatus
  scopes: string[]
  tokenExpiresAt: string | null
  lastValidatedAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

const PROVIDER_INFO: Record<SocialProvider, { name: string; icon: string; color: string }> = {
  x: { name: "X (Twitter)", icon: "X", color: "bg-black" },
  instagram: { name: "Instagram", icon: "IG", color: "bg-gradient-to-br from-purple-600 to-pink-500" },
  youtube: { name: "YouTube", icon: "YT", color: "bg-red-600" },
  whatsapp: { name: "WhatsApp", icon: "WA", color: "bg-green-500" },
}

const STATUS_VARIANTS: Record<SocialAccountStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "有効", variant: "default" },
  inactive: { label: "無効", variant: "secondary" },
  expired: { label: "期限切れ", variant: "destructive" },
  revoked: { label: "取り消し済み", variant: "destructive" },
}

export function AccountList() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<SocialAccountDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<SocialAccountDisplay | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    try {
      setLoading(true)
      const response = await fetch("/api/social/accounts")
      const result = await response.json()

      if (result.success) {
        setAccounts(result.data)
      } else {
        toast.error(result.error || "アカウントの取得に失敗しました")
      }
    } catch {
      toast.error("アカウントの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!accountToDelete) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/social/accounts/${accountToDelete.id}`, {
        method: "DELETE",
      })
      const result = await response.json()

      if (result.success) {
        toast.success("アカウントを削除しました")
        setAccounts(accounts.filter((a) => a.id !== accountToDelete.id))
      } else {
        toast.error(result.error || "削除に失敗しました")
      }
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setAccountToDelete(null)
    }
  }

  async function handleReconnect(provider: SocialProvider) {
    try {
      const response = await fetch("/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: provider }),
      })
      const result = await response.json()

      if (result.success && result.data.authorizationUrl) {
        window.location.href = result.data.authorizationUrl
      } else {
        toast.error(result.error || "再接続の開始に失敗しました")
      }
    } catch {
      toast.error("再接続の開始に失敗しました")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-muted-foreground mb-4">
            接続されているアカウントはありません
          </div>
          <Button onClick={() => router.push("/dashboard/social/connect")}>
            <Plus className="mr-2 size-4" />
            アカウントを接続
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => {
          const providerInfo = PROVIDER_INFO[account.provider]
          const statusInfo = STATUS_VARIANTS[account.status]

          return (
            <Card key={account.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-full text-white ${providerInfo.color}`}>
                      <span className="text-sm font-bold">{providerInfo.icon}</span>
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {account.displayName || account.username || "Unknown"}
                      </CardTitle>
                      <CardDescription>
                        {account.username ? `@${account.username}` : providerInfo.name}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {account.profileImageUrl && (
                    <Avatar className="size-8">
                      <AvatarImage src={account.profileImageUrl} alt={account.displayName || ""} />
                      <AvatarFallback>
                        {(account.displayName || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {providerInfo.name}
                  </span>
                </div>

                {account.status === "expired" && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="size-4" />
                    <span>トークンの更新が必要です</span>
                  </div>
                )}

                {account.errorMessage && (
                  <div className="mt-3 text-sm text-destructive">
                    {account.errorMessage}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  {account.status === "expired" || account.status === "revoked" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReconnect(account.provider)}
                    >
                      <RefreshCw className="mr-2 size-3" />
                      再接続
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = account.provider === "x"
                          ? `https://x.com/${account.username}`
                          : account.provider === "instagram"
                          ? `https://instagram.com/${account.username}`
                          : account.provider === "youtube"
                          ? `https://youtube.com/channel/${account.providerAccountId}`
                          : "#"
                        window.open(url, "_blank")
                      }}
                    >
                      <ExternalLink className="mr-2 size-3" />
                      プロフィール
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setAccountToDelete(account)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>アカウントを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountToDelete && (
                <>
                  <strong>{PROVIDER_INFO[accountToDelete.provider].name}</strong>
                  {" "}の接続を解除します。
                  このアカウントでスケジュールされた投稿は送信されなくなります。
                </>
              )}
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
