import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Share2, Calendar, BarChart3, ShoppingBag } from "lucide-react"
import { AccountList } from "@/components/social/account-list"

export const metadata = {
  title: "SNS投稿 | MailFlow",
  description: "SNS投稿管理ダッシュボード",
}

async function getStats(userId: string) {
  const supabase = await createClient()

  const [accountsResult, postsResult, scheduledResult] = await Promise.all([
    supabase
      .from("social_accounts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("social_posts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "published"),
    supabase
      .from("social_posts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "scheduled"),
  ])

  return {
    connectedAccounts: accountsResult.count || 0,
    publishedPosts: postsResult.count || 0,
    scheduledPosts: scheduledResult.count || 0,
  }
}

function StatsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function Stats({ userId }: { userId: string }) {
  const stats = await getStats(userId)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">接続アカウント</CardTitle>
          <Share2 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.connectedAccounts}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">公開済み投稿</CardTitle>
          <BarChart3 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.publishedPosts}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">予約投稿</CardTitle>
          <Calendar className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function SocialDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SNS投稿</h1>
          <p className="text-muted-foreground">
            X、Instagram、YouTube、WhatsAppへの投稿を管理
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/social/connect">
              <Plus className="mr-2 size-4" />
              アカウント接続
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/social/posts/new">
              <Plus className="mr-2 size-4" />
              新規投稿
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<StatsLoading />}>
        <Stats userId={user.id} />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>接続済みアカウント</CardTitle>
          <CardDescription>
            投稿を配信するSNSアカウントを管理できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountList />
        </CardContent>
      </Card>

      {/* eBay Tools Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                eBay SNS誘導ツール
              </CardTitle>
              <CardDescription>
                eBayバイヤーをSNSフォロワーに変換するためのテンプレートを生成
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/dashboard/social/ebay-tools">
                ツールを開く
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">サンキューカード</p>
              <p className="text-sm text-muted-foreground">商品同梱用の感謝カード</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">パッケージインサート</p>
              <p className="text-sm text-muted-foreground">同梱チラシでフォロー促進</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">購入後メッセージ</p>
              <p className="text-sm text-muted-foreground">発送通知でSNS案内</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
