"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { CalendarIcon, Loader2, Send, Clock, Save, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { XPreview } from "./previews/x-preview"
import type { SocialProvider } from "@/lib/social/types"

interface Account {
  id: string
  provider: SocialProvider
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  status: string
}

const PROVIDER_NAMES: Record<SocialProvider, string> = {
  x: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
}

const PROVIDER_LIMITS: Record<SocialProvider, number> = {
  x: 280,
  instagram: 2200,
  youtube: 5000,
  whatsapp: 4096,
}

interface PostComposerProps {
  initialContent?: string
  initialTitle?: string
  postId?: string
  mode?: "create" | "edit"
}

export function PostComposer({
  initialContent = "",
  initialTitle = "",
  postId,
  mode = "create",
}: PostComposerProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [scheduledTime, setScheduledTime] = useState("12:00")
  const [loading, setLoading] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [activePreview, setActivePreview] = useState<SocialProvider>("x")

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    try {
      const response = await fetch("/api/social/accounts")
      const result = await response.json()

      if (result.success) {
        const activeAccounts = result.data.filter(
          (a: Account) => a.status === "active"
        )
        setAccounts(activeAccounts)

        // Auto-select first account of each provider
        const autoSelected = activeAccounts.reduce((acc: string[], account: Account) => {
          const hasProvider = acc.some((id) =>
            activeAccounts.find((a: Account) => a.id === id)?.provider === account.provider
          )
          if (!hasProvider) {
            acc.push(account.id)
          }
          return acc
        }, [])
        setSelectedAccounts(autoSelected)
      }
    } catch {
      toast.error("アカウント一覧の取得に失敗しました")
    } finally {
      setLoadingAccounts(false)
    }
  }

  function handleAccountToggle(accountId: string) {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    )
  }

  function getCharacterCount(provider: SocialProvider): { count: number; limit: number; over: boolean } {
    const limit = PROVIDER_LIMITS[provider]
    let count = content.length

    // X counts URLs as 23 chars
    if (provider === "x") {
      const urlRegex = /https?:\/\/[^\s]+/g
      const urls = content.match(urlRegex) || []
      for (const url of urls) {
        count = count - url.length + 23
      }
    }

    return { count, limit, over: count > limit }
  }

  function getScheduledDateTime(): string | null {
    if (!scheduledDate) return null

    const [hours, minutes] = scheduledTime.split(":").map(Number)
    const dateTime = new Date(scheduledDate)
    dateTime.setHours(hours, minutes, 0, 0)
    return dateTime.toISOString()
  }

  async function handleSubmit(action: "draft" | "schedule" | "publish") {
    if (!content.trim()) {
      toast.error("投稿内容を入力してください")
      return
    }

    if (selectedAccounts.length === 0) {
      toast.error("少なくとも1つのアカウントを選択してください")
      return
    }

    // Validate character limits
    const selectedProviders = [...new Set(
      selectedAccounts.map((id) => accounts.find((a) => a.id === id)?.provider).filter(Boolean)
    )] as SocialProvider[]

    for (const provider of selectedProviders) {
      const { over, count, limit } = getCharacterCount(provider)
      if (over) {
        toast.error(`${PROVIDER_NAMES[provider]}の文字数制限を超えています (${count}/${limit})`)
        return
      }
    }

    if (action === "schedule" && !scheduledDate) {
      toast.error("スケジュール日時を選択してください")
      return
    }

    try {
      setLoading(true)

      const payload = {
        title: title || undefined,
        content,
        scheduledAt: action === "schedule" ? getScheduledDateTime() : null,
        channels: selectedAccounts.map((accountId) => ({
          accountId,
          config: {},
        })),
        status: action === "draft" ? "draft" : "scheduled",
      }

      let response: Response
      if (mode === "edit" && postId) {
        response = await fetch(`/api/social/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch("/api/social/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      const createdPostId = result.data.id

      // If publishing immediately, call publish endpoint
      if (action === "publish") {
        const publishResponse = await fetch(`/api/social/posts/${createdPostId}/publish`, {
          method: "POST",
        })
        const publishResult = await publishResponse.json()

        if (publishResult.success) {
          if (publishResult.data.allSuccessful) {
            toast.success("投稿を公開しました")
          } else {
            const failedCount = publishResult.data.results.filter((r: { success: boolean }) => !r.success).length
            toast.warning(`一部のチャンネルで投稿に失敗しました (${failedCount}件)`)
          }
        } else {
          throw new Error(publishResult.error)
        }
      } else if (action === "schedule") {
        toast.success("投稿をスケジュールしました")
      } else {
        toast.success("下書きを保存しました")
      }

      router.push("/dashboard/social/posts")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "投稿に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  const selectedAccount = accounts.find((a) =>
    selectedAccounts.includes(a.id) && a.provider === activePreview
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Composer */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>投稿を作成</CardTitle>
            <CardDescription>
              複数のSNSに同時に投稿できます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル（オプション）</Label>
              <Input
                id="title"
                placeholder="投稿タイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">投稿内容</Label>
              <Textarea
                id="content"
                placeholder="投稿内容を入力..."
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {/* Character counts */}
              <div className="flex flex-wrap gap-2">
                {(["x", "instagram", "youtube", "whatsapp"] as SocialProvider[])
                  .filter((p) => selectedAccounts.some((id) =>
                    accounts.find((a) => a.id === id)?.provider === p
                  ))
                  .map((provider) => {
                    const { count, limit, over } = getCharacterCount(provider)
                    return (
                      <Badge
                        key={provider}
                        variant={over ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {PROVIDER_NAMES[provider]}: {count}/{limit}
                      </Badge>
                    )
                  })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">配信先アカウント</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle className="size-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  接続されているアカウントがありません
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => router.push("/dashboard/social/connect")}
                >
                  アカウントを接続
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => handleAccountToggle(account.id)}
                    />
                    <Avatar className="size-8">
                      {account.profileImageUrl && (
                        <AvatarImage src={account.profileImageUrl} />
                      )}
                      <AvatarFallback>
                        {PROVIDER_NAMES[account.provider][0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {account.displayName || account.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {PROVIDER_NAMES[account.provider]}
                        {account.username && ` · @${account.username}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">スケジュール設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 size-4" />
                    {scheduledDate ? (
                      format(scheduledDate, "PPP", { locale: ja })
                    ) : (
                      <span>日付を選択</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>

              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-32"
              />
            </div>

            {scheduledDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScheduledDate(undefined)}
              >
                スケジュールをクリア
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit("draft")}
            disabled={loading || !content.trim()}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            下書き保存
          </Button>

          {scheduledDate ? (
            <Button
              onClick={() => handleSubmit("schedule")}
              disabled={loading || !content.trim() || selectedAccounts.length === 0}
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Clock className="mr-2 size-4" />}
              スケジュール
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit("publish")}
              disabled={loading || !content.trim() || selectedAccounts.length === 0}
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              今すぐ投稿
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">プレビュー</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activePreview} onValueChange={(v) => setActivePreview(v as SocialProvider)}>
              <TabsList className="mb-4">
                {(["x", "instagram", "youtube", "whatsapp"] as SocialProvider[])
                  .filter((p) => selectedAccounts.some((id) =>
                    accounts.find((a) => a.id === id)?.provider === p
                  ))
                  .map((provider) => (
                    <TabsTrigger key={provider} value={provider}>
                      {PROVIDER_NAMES[provider]}
                    </TabsTrigger>
                  ))}
              </TabsList>

              <TabsContent value="x">
                <XPreview
                  content={content || "投稿内容がここに表示されます..."}
                  displayName={selectedAccount?.displayName || "ユーザー名"}
                  username={selectedAccount?.username || "username"}
                  profileImageUrl={selectedAccount?.profileImageUrl || undefined}
                />
              </TabsContent>

              <TabsContent value="instagram">
                <div className="text-center text-muted-foreground py-8">
                  Instagramプレビュー（実装予定）
                </div>
              </TabsContent>

              <TabsContent value="youtube">
                <div className="text-center text-muted-foreground py-8">
                  YouTubeプレビュー（実装予定）
                </div>
              </TabsContent>

              <TabsContent value="whatsapp">
                <div className="text-center text-muted-foreground py-8">
                  WhatsAppプレビュー（実装予定）
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
