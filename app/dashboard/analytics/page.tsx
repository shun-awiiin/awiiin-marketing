import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import { ClientDate } from "@/components/ui/client-date";
import { ClientNumber } from "@/components/ui/client-number";

async function getAnalytics(userId: string) {
  const supabase = await createClient();

  // 総送信数
  const { count: totalMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true });

  // ステータス別集計
  const { data: statusCounts } = await supabase
    .from("messages")
    .select("status");

  const stats = {
    total: totalMessages ?? 0,
    sent: statusCounts?.filter((m) => m.status === "sent").length ?? 0,
    failed: statusCounts?.filter((m) => m.status === "failed").length ?? 0,
    bounced: statusCounts?.filter((m) => m.status === "bounced").length ?? 0,
    pending: statusCounts?.filter((m) => m.status === "pending").length ?? 0,
  };

  // 配信停止数
  const { count: unsubscribeCount } = await supabase
    .from("unsubscribes")
    .select("*", { count: "exact", head: true });

  // 最近のイベント
  const { data: recentEvents } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  // キャンペーン別統計
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const campaignStats = await Promise.all(
    (campaigns ?? []).map(async (campaign) => {
      const { data: messages } = await supabase
        .from("messages")
        .select("status")
        .eq("campaign_id", campaign.id);

      return {
        ...campaign,
        total: messages?.length ?? 0,
        sent: messages?.filter((m) => m.status === "sent").length ?? 0,
        failed: messages?.filter((m) => m.status === "failed").length ?? 0,
        bounced: messages?.filter((m) => m.status === "bounced").length ?? 0,
      };
    })
  );

  return {
    stats,
    unsubscribeCount: unsubscribeCount ?? 0,
    recentEvents: recentEvents ?? [],
    campaignStats,
  };
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { stats, unsubscribeCount, recentEvents, campaignStats } =
    await getAnalytics(user.id);

  const deliveryRate =
    stats.sent > 0
      ? (((stats.sent - stats.bounced) / stats.sent) * 100).toFixed(1)
      : "0";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">分析</h1>
        <p className="text-muted-foreground">
          メール配信の統計情報を確認できます
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">総送信数</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <ClientNumber value={stats.total} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">送信成功</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              <ClientNumber value={stats.sent} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">到達率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              バウンス: {stats.bounced}件
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">配信停止</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unsubscribeCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>キャンペーン別統計</CardTitle>
            <CardDescription>最近のキャンペーンの配信結果</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キャンペーン</TableHead>
                  <TableHead className="text-right">送信</TableHead>
                  <TableHead className="text-right">成功</TableHead>
                  <TableHead className="text-right">到達率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">
                        キャンペーンデータがありません
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  campaignStats.map((campaign) => {
                    const rate =
                      campaign.sent > 0
                        ? (
                            ((campaign.sent - campaign.bounced) / campaign.sent) *
                            100
                          ).toFixed(1)
                        : "0";
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          {campaign.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.total}
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.sent}
                        </TableCell>
                        <TableCell className="text-right">{rate}%</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近のイベント</CardTitle>
            <CardDescription>バウンス、配信停止などのイベント</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  イベントがありません
                </p>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <EventIcon type={event.event_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {event.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getEventLabel(event.event_type)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      <ClientDate date={event.created_at} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "bounce":
      return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
    case "spam_report":
      return <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />;
    case "unsubscribe":
      return <Users className="h-5 w-5 text-blue-500 flex-shrink-0" />;
    default:
      return <Send className="h-5 w-5 text-muted-foreground flex-shrink-0" />;
  }
}

function getEventLabel(type: string): string {
  const labels: Record<string, string> = {
    bounce: "バウンス",
    spam_report: "スパム報告",
    unsubscribe: "配信停止",
  };
  return labels[type] || type;
}
