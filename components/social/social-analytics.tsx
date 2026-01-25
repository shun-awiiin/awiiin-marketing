"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, Users } from "lucide-react"
import { toast } from "sonner"
import type { SocialProvider } from "@/lib/social/types"

interface ChannelStats {
  id: string
  provider: SocialProvider
  displayName: string
  username: string | null
  profileImageUrl: string | null
  metrics: {
    totalPosts: number
    publishedPosts: number
    scheduledPosts: number
    failedPosts: number
    totalEngagement: {
      views: number
      likes: number
      comments: number
      shares: number
    }
  }
}

interface OverallStats {
  totalAccounts: number
  activeAccounts: number
  totalPosts: number
  publishedPosts: number
  scheduledPosts: number
  totalEngagement: {
    views: number
    likes: number
    comments: number
    shares: number
  }
}

const PROVIDER_NAMES: Record<SocialProvider, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
}

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  x: "bg-black",
  instagram: "bg-gradient-to-br from-purple-600 to-pink-500",
  youtube: "bg-red-600",
  whatsapp: "bg-green-500",
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
        {trend !== undefined && (
          <div className={`flex items-center text-xs ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? (
              <TrendingUp className="size-3 mr-1" />
            ) : (
              <TrendingDown className="size-3 mr-1" />
            )}
            <span>{Math.abs(trend)}% 前週比</span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function SocialAnalytics() {
  const [loading, setLoading] = useState(true)
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([])
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    try {
      setLoading(true)

      // Fetch accounts
      const accountsResponse = await fetch("/api/social/accounts")
      const accountsResult = await accountsResponse.json()

      if (!accountsResult.success) {
        throw new Error(accountsResult.error)
      }

      // Fetch posts
      const postsResponse = await fetch("/api/social/posts?limit=1000")
      const postsResult = await postsResponse.json()

      if (!postsResult.success) {
        throw new Error(postsResult.error)
      }

      const accounts = accountsResult.data
      const posts = postsResult.data

      // Calculate overall stats
      const overall: OverallStats = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter((a: { status: string }) => a.status === "active").length,
        totalPosts: posts.length,
        publishedPosts: posts.filter((p: { status: string }) => p.status === "published").length,
        scheduledPosts: posts.filter((p: { status: string }) => p.status === "scheduled").length,
        totalEngagement: {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        },
      }

      // Calculate per-channel stats
      const channelMap = new Map<string, ChannelStats>()

      for (const account of accounts) {
        channelMap.set(account.id, {
          id: account.id,
          provider: account.provider,
          displayName: account.displayName || account.username || "Unknown",
          username: account.username,
          profileImageUrl: account.profileImageUrl,
          metrics: {
            totalPosts: 0,
            publishedPosts: 0,
            scheduledPosts: 0,
            failedPosts: 0,
            totalEngagement: {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
            },
          },
        })
      }

      // Aggregate post data
      for (const post of posts) {
        for (const channel of post.channels || []) {
          const stats = channelMap.get(channel.account?.id)
          if (stats) {
            stats.metrics.totalPosts++
            if (channel.status === "published") {
              stats.metrics.publishedPosts++

              // Add engagement data if available
              const engagement = channel.engagement_data || {}
              stats.metrics.totalEngagement.views += engagement.views || 0
              stats.metrics.totalEngagement.likes += engagement.likes || 0
              stats.metrics.totalEngagement.comments += engagement.comments || 0
              stats.metrics.totalEngagement.shares += engagement.shares || 0

              overall.totalEngagement.views += engagement.views || 0
              overall.totalEngagement.likes += engagement.likes || 0
              overall.totalEngagement.comments += engagement.comments || 0
              overall.totalEngagement.shares += engagement.shares || 0
            } else if (channel.status === "scheduled") {
              stats.metrics.scheduledPosts++
            } else if (channel.status === "failed") {
              stats.metrics.failedPosts++
            }
          }
        }
      }

      setOverallStats(overall)
      setChannelStats(Array.from(channelMap.values()))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分析データの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }

  if (!overallStats) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          分析データがありません
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="channels">チャンネル別</TabsTrigger>
          <TabsTrigger value="engagement">エンゲージメント</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="接続アカウント"
              value={overallStats.activeAccounts}
              icon={Users}
              description={`${overallStats.totalAccounts}件中アクティブ`}
            />
            <MetricCard
              title="投稿数"
              value={overallStats.publishedPosts}
              icon={Share2}
              description={`${overallStats.scheduledPosts}件予約中`}
            />
            <MetricCard
              title="総閲覧数"
              value={overallStats.totalEngagement.views}
              icon={Eye}
            />
            <MetricCard
              title="総いいね"
              value={overallStats.totalEngagement.likes}
              icon={Heart}
            />
          </div>

          {/* Engagement Summary */}
          <Card>
            <CardHeader>
              <CardTitle>エンゲージメントサマリー</CardTitle>
              <CardDescription>
                全プラットフォームの合計エンゲージメント
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Eye className="size-6 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(overallStats.totalEngagement.views)}
                  </div>
                  <div className="text-sm text-muted-foreground">閲覧数</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Heart className="size-6 mx-auto mb-2 text-red-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(overallStats.totalEngagement.likes)}
                  </div>
                  <div className="text-sm text-muted-foreground">いいね</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <MessageCircle className="size-6 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(overallStats.totalEngagement.comments)}
                  </div>
                  <div className="text-sm text-muted-foreground">コメント</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Share2 className="size-6 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(overallStats.totalEngagement.shares)}
                  </div>
                  <div className="text-sm text-muted-foreground">シェア</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          {channelStats.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                接続されているアカウントがありません
              </CardContent>
            </Card>
          ) : (
            channelStats.map((channel) => (
              <Card key={channel.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-full text-white text-sm font-bold ${
                        PROVIDER_COLORS[channel.provider]
                      }`}
                    >
                      {channel.provider === "x" ? "X" :
                       channel.provider === "instagram" ? "IG" :
                       channel.provider === "youtube" ? "YT" : "WA"}
                    </div>
                    <div>
                      <CardTitle className="text-base">{channel.displayName}</CardTitle>
                      <CardDescription>
                        {PROVIDER_NAMES[channel.provider]}
                        {channel.username && ` · @${channel.username}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <div className="text-sm text-muted-foreground">公開済み</div>
                      <div className="text-xl font-bold">{channel.metrics.publishedPosts}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">予約中</div>
                      <div className="text-xl font-bold">{channel.metrics.scheduledPosts}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">閲覧数</div>
                      <div className="text-xl font-bold">
                        {formatNumber(channel.metrics.totalEngagement.views)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">いいね</div>
                      <div className="text-xl font-bold">
                        {formatNumber(channel.metrics.totalEngagement.likes)}
                      </div>
                    </div>
                  </div>
                  {channel.metrics.failedPosts > 0 && (
                    <Badge variant="destructive" className="mt-4">
                      {channel.metrics.failedPosts}件の投稿に失敗
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>エンゲージメント詳細</CardTitle>
              <CardDescription>
                投稿ごとのパフォーマンスを確認できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                詳細なエンゲージメント分析機能は今後追加予定です
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
