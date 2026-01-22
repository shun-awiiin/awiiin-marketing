import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  Users,
  Send,
  CheckCircle,
  AlertTriangle,
  Plus,
  TrendingUp,
  Mail,
  XCircle,
  AlertCircle,
  FileText,
  Shield,
  ArrowRight,
} from "lucide-react";
import { calculateDeliverabilityScore } from "@/lib/deliverability/deliverability-score";

async function getStats(userId: string) {
  const supabase = await createClient();

  // Get date ranges
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    contactsResult,
    activeContactsResult,
    campaignsResult,
    activeCampaignsResult,
    todaySentResult,
    weekSentResult,
    weekDeliveredResult,
    weekBouncedResult,
    weekComplainedResult,
  ] = await Promise.all([
    // Total contacts
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    // Active contacts
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    // Total campaigns
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    // Active campaigns (sending/queued)
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["sending", "queued"]),
    // Today's sent
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", todayStart)
      .in("status", ["sent", "delivered"]),
    // Week's sent
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", weekAgo)
      .in("status", ["sent", "delivered", "bounced", "complained"]),
    // Week's delivered
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("delivered_at", weekAgo)
      .eq("status", "delivered"),
    // Week's bounced
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("bounced_at", weekAgo)
      .eq("status", "bounced"),
    // Week's complained
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo)
      .eq("status", "complained"),
  ]);

  const weekSent = weekSentResult.count ?? 0;
  const weekDelivered = weekDeliveredResult.count ?? 0;
  const weekBounced = weekBouncedResult.count ?? 0;
  const weekComplained = weekComplainedResult.count ?? 0;

  return {
    contacts: contactsResult.count ?? 0,
    activeContacts: activeContactsResult.count ?? 0,
    campaigns: campaignsResult.count ?? 0,
    activeCampaigns: activeCampaignsResult.count ?? 0,
    todaySent: todaySentResult.count ?? 0,
    weekSent,
    weekDelivered,
    weekBounced,
    weekComplained,
    deliveryRate: weekSent > 0 ? ((weekDelivered / weekSent) * 100).toFixed(1) : "0",
    bounceRate: weekSent > 0 ? ((weekBounced / weekSent) * 100).toFixed(2) : "0",
    complaintRate: weekSent > 0 ? ((weekComplained / weekSent) * 100).toFixed(3) : "0",
  };
}

async function getRecentCampaigns(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  return data ?? [];
}

async function getRecentAlerts(userId: string) {
  const supabase = await createClient();

  // Get campaigns with issues
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, stop_reason")
    .eq("user_id", userId)
    .eq("status", "stopped")
    .not("stop_reason", "is", null)
    .order("completed_at", { ascending: false })
    .limit(3);

  // Get recent bounces
  const { data: bounces } = await supabase
    .from("events")
    .select("email, occurred_at")
    .eq("event_type", "bounce")
    .order("occurred_at", { ascending: false })
    .limit(3);

  // Get recent complaints
  const { data: complaints } = await supabase
    .from("events")
    .select("email, occurred_at")
    .in("event_type", ["complaint", "spam_report"])
    .order("occurred_at", { ascending: false })
    .limit(3);

  return {
    stoppedCampaigns: campaigns ?? [],
    recentBounces: bounces ?? [],
    recentComplaints: complaints ?? [],
  };
}

async function getDeliverabilityScore(userId: string) {
  try {
    return await calculateDeliverabilityScore(userId);
  } catch {
    // Return default score if calculation fails
    return {
      overall_score: 0,
      grade: "N/A" as const,
      factors: {
        bounce_rate: { score: 0, value: 0, status: "unknown" as const },
        complaint_rate: { score: 0, value: 0, status: "unknown" as const },
        list_quality: { score: 0, value: 0, status: "unknown" as const },
        domain_health: { score: 0, value: 0, status: "unknown" as const },
        engagement: { score: 0, value: 0, status: "unknown" as const },
        authentication: { score: 0, value: 0, status: "unknown" as const },
      },
      recommendations: [],
      calculated_at: new Date().toISOString(),
    };
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [stats, recentCampaigns, alerts, deliverabilityScore] = await Promise.all([
    getStats(user.id),
    getRecentCampaigns(user.id),
    getRecentAlerts(user.id),
    getDeliverabilityScore(user.id),
  ]);

  const hasAlerts =
    alerts.stoppedCampaigns.length > 0 ||
    alerts.recentComplaints.length > 0 ||
    parseFloat(stats.bounceRate) >= 3;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-muted-foreground">
            メール配信の概要を確認できます
          </p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新規キャンペーン
          </Button>
        </Link>
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              要注意
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.stoppedCampaigns.map((campaign) => (
              <div key={campaign.id} className="text-sm text-orange-700">
                キャンペーン「{campaign.name}」が自動停止されました：{campaign.stop_reason}
              </div>
            ))}
            {alerts.recentComplaints.length > 0 && (
              <div className="text-sm text-orange-700">
                直近で{alerts.recentComplaints.length}件の苦情報告がありました
              </div>
            )}
            {parseFloat(stats.bounceRate) >= 3 && (
              <div className="text-sm text-orange-700">
                バウンス率が{stats.bounceRate}%です。連絡先リストの品質を確認してください
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deliverability Score Card */}
      <Link href="/dashboard/deliverability">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                    deliverabilityScore.overall_score >= 80
                      ? "bg-green-500"
                      : deliverabilityScore.overall_score >= 60
                      ? "bg-yellow-500"
                      : deliverabilityScore.overall_score >= 40
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                >
                  {deliverabilityScore.overall_score}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">配信品質スコア</h3>
                  <p className="text-sm text-muted-foreground">
                    グレード: {deliverabilityScore.grade}
                    {deliverabilityScore.recommendations.length > 0 &&
                      ` - ${deliverabilityScore.recommendations.length}件の改善提案`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">詳細を見る</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
            {deliverabilityScore.overall_score > 0 && (
              <div className="mt-4">
                <Progress value={deliverabilityScore.overall_score} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">連絡先</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeContacts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              有効 / {stats.contacts.toLocaleString()}件中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日の送信</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaySent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCampaigns > 0 ? `${stats.activeCampaigns}件進行中` : "進行中なし"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">7日間到達率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.weekDelivered.toLocaleString()} / {stats.weekSent.toLocaleString()}件
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">配信品質</CardTitle>
            {parseFloat(stats.bounceRate) < 2 && parseFloat(stats.complaintRate) < 0.05 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-sm">バウンス</span>
              <span className={`font-bold ${parseFloat(stats.bounceRate) >= 5 ? 'text-red-600' : ''}`}>
                {stats.bounceRate}%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm">苦情</span>
              <span className={`font-bold ${parseFloat(stats.complaintRate) >= 0.1 ? 'text-red-600' : ''}`}>
                {stats.complaintRate}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近のキャンペーン</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Send className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  まだキャンペーンがありません
                </p>
                <Link href="/dashboard/campaigns/new">
                  <Button variant="outline" size="sm">
                    最初のキャンペーンを作成
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentCampaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{campaign.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(campaign.created_at).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </Link>
                ))}
                <Link href="/dashboard/campaigns">
                  <Button variant="ghost" size="sm" className="w-full mt-2">
                    すべて表示
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">クイックアクション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Link href="/dashboard/campaigns/new">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Plus className="mr-2 h-4 w-4" />
                  新規キャンペーン作成
                </Button>
              </Link>
              <Link href="/dashboard/contacts">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Users className="mr-2 h-4 w-4" />
                  連絡先を管理
                </Button>
              </Link>
              <Link href="/dashboard/deliverability">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Shield className="mr-2 h-4 w-4" />
                  配信品質を確認
                </Button>
              </Link>
              <Link href="/dashboard/templates">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <FileText className="mr-2 h-4 w-4" />
                  テンプレートを確認
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { label: string; className: string }
  > = {
    draft: {
      label: "下書き",
      className: "bg-muted text-muted-foreground",
    },
    scheduled: {
      label: "予約済み",
      className: "bg-blue-100 text-blue-700",
    },
    queued: {
      label: "キュー中",
      className: "bg-blue-100 text-blue-700",
    },
    sending: {
      label: "送信中",
      className: "bg-yellow-100 text-yellow-700",
    },
    completed: {
      label: "完了",
      className: "bg-green-100 text-green-700",
    },
    paused: {
      label: "一時停止",
      className: "bg-orange-100 text-orange-700",
    },
    stopped: {
      label: "停止",
      className: "bg-red-100 text-red-700",
    },
    failed: {
      label: "失敗",
      className: "bg-red-100 text-red-700",
    },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
