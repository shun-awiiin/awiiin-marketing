import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, ArrowLeft, Calendar, Send, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"

export const metadata = {
  title: "投稿一覧 | SNS投稿",
}

const STATUS_CONFIG = {
  draft: { label: "下書き", icon: FileText, variant: "secondary" as const },
  scheduled: { label: "予約済み", icon: Calendar, variant: "outline" as const },
  publishing: { label: "公開中", icon: Send, variant: "default" as const },
  published: { label: "公開済み", icon: CheckCircle2, variant: "default" as const },
  failed: { label: "失敗", icon: AlertCircle, variant: "destructive" as const },
  cancelled: { label: "キャンセル", icon: AlertCircle, variant: "secondary" as const },
}

async function getPosts(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("social_posts")
    .select(`
      *,
      channels:post_channel_targets(
        id,
        provider,
        status,
        account:social_accounts(display_name, username)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}

function PostsLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Skeleton className="h-20 w-20 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function PostsList({ userId }: { userId: string }) {
  const posts = await getPosts(userId)

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">まだ投稿がありません</p>
          <Button asChild>
            <Link href="/dashboard/social/posts/new">
              <Plus className="mr-2 size-4" />
              投稿を作成
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const config = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG]
        const StatusIcon = config?.icon || FileText

        return (
          <Link key={post.id} href={`/dashboard/social/posts/${post.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={config?.variant || "secondary"}>
                        <StatusIcon className="size-3 mr-1" />
                        {config?.label || post.status}
                      </Badge>
                      {post.scheduled_at && post.status === "scheduled" && (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(post.scheduled_at), {
                            addSuffix: true,
                            locale: ja,
                          })}
                        </span>
                      )}
                    </div>

                    {post.title && (
                      <h3 className="font-medium mb-1">{post.title}</h3>
                    )}

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {post.content}
                    </p>

                    <div className="flex items-center gap-2 mt-3">
                      {post.channels?.map((channel: { id: string; provider: string }) => (
                        <Badge key={channel.id} variant="outline" className="text-xs">
                          {channel.provider === "x" ? "X" :
                           channel.provider === "instagram" ? "IG" :
                           channel.provider === "youtube" ? "YT" :
                           channel.provider === "whatsapp" ? "WA" : channel.provider}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                          locale: ja,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export default async function SocialPostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/social">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">投稿一覧</h1>
          <p className="text-muted-foreground">すべての投稿を管理</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/social/posts/new">
            <Plus className="mr-2 size-4" />
            新規投稿
          </Link>
        </Button>
      </div>

      <Suspense fallback={<PostsLoading />}>
        <PostsList userId={user.id} />
      </Suspense>
    </div>
  )
}
