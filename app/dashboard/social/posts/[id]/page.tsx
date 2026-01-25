import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Edit, Trash2, Send, ExternalLink, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { PostActions } from "./post-actions"
import { ClientDate } from "@/components/ui/client-date"

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_CONFIG = {
  draft: { label: "下書き", variant: "secondary" as const, icon: Edit },
  scheduled: { label: "予約済み", variant: "outline" as const, icon: Clock },
  publishing: { label: "公開中", variant: "default" as const, icon: Send },
  published: { label: "公開済み", variant: "default" as const, icon: CheckCircle2 },
  failed: { label: "失敗", variant: "destructive" as const, icon: AlertCircle },
  cancelled: { label: "キャンセル", variant: "secondary" as const, icon: AlertCircle },
}

const PROVIDER_NAMES: Record<string, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: post, error } = await supabase
    .from("social_posts")
    .select(`
      *,
      channels:post_channel_targets(
        id,
        provider,
        status,
        provider_post_id,
        published_at,
        error_message,
        retry_count,
        engagement_data,
        account:social_accounts(
          id,
          provider,
          display_name,
          username,
          profile_image_url
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !post) {
    notFound()
  }

  const config = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG]
  const StatusIcon = config?.icon || Edit
  const canEdit = ["draft", "scheduled"].includes(post.status)
  const canPublish = ["draft", "scheduled"].includes(post.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/social/posts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {post.title || "投稿詳細"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={config?.variant || "secondary"}>
              <StatusIcon className="size-3 mr-1" />
              {config?.label || post.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              作成: <ClientDate date={post.created_at} format="relative" />
            </span>
          </div>
        </div>
        <PostActions postId={post.id} canEdit={canEdit} canPublish={canPublish} />
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">投稿内容</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap">{post.content}</div>
        </CardContent>
      </Card>

      {/* Schedule */}
      {post.scheduled_at && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">スケジュール</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span>
                {format(new Date(post.scheduled_at), "PPP HH:mm", { locale: ja })}
              </span>
              <span className="text-muted-foreground">
                (<ClientDate date={post.scheduled_at} format="relative" />)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配信チャンネル</CardTitle>
          <CardDescription>
            {post.channels?.length || 0}件のチャンネルに配信
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {post.channels?.map((channel: {
              id: string
              provider: string
              status: string
              provider_post_id: string | null
              published_at: string | null
              error_message: string | null
              account: {
                display_name: string | null
                username: string | null
                profile_image_url: string | null
              } | null
            }) => {
              const channelConfig = STATUS_CONFIG[channel.status as keyof typeof STATUS_CONFIG]
              const ChannelIcon = channelConfig?.icon || Edit

              return (
                <div key={channel.id} className="flex items-center gap-4 p-4 rounded-lg border">
                  <Avatar className="size-10">
                    {channel.account?.profile_image_url && (
                      <AvatarImage src={channel.account.profile_image_url} />
                    )}
                    <AvatarFallback>
                      {channel.provider === "x" ? "X" :
                       channel.provider === "instagram" ? "IG" :
                       channel.provider === "youtube" ? "YT" : "WA"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">
                      {channel.account?.display_name || channel.account?.username || "Unknown"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {PROVIDER_NAMES[channel.provider] || channel.provider}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={channelConfig?.variant || "secondary"}>
                      <ChannelIcon className="size-3 mr-1" />
                      {channelConfig?.label || channel.status}
                    </Badge>
                    {channel.provider_post_id && channel.status === "published" && (
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={
                            channel.provider === "x"
                              ? `https://x.com/i/status/${channel.provider_post_id}`
                              : "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {channel.error_message && (
                    <div className="w-full mt-2 text-sm text-destructive">
                      {channel.error_message}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
