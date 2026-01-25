"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, ShoppingCart, MousePointerClick, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Funnel {
  id: string;
  name: string;
  status: string;
  funnel_steps: { id: string; name: string; step_type: string }[];
}

interface Conversion {
  id: string;
  event_type: string;
  revenue: number | null;
  created_at: string;
  visitors: { visitor_id: string; first_seen_at: string } | null;
}

interface DailyStat {
  date: string;
  funnel_id: string;
  step_id: string | null;
  visitors: number;
  conversions: number;
  revenue: number;
}

interface TrackingLink {
  id: string;
  name: string;
  short_code: string;
  total_clicks: number;
  unique_clicks: number;
}

interface Summary {
  totalRevenue: number;
  totalConversions: number;
  avgOrderValue: number;
}

interface ResultsDashboardClientProps {
  funnels: Funnel[];
  conversions: Conversion[];
  dailyStats: DailyStat[];
  trackingLinks: TrackingLink[];
  summary: Summary;
}

export function ResultsDashboardClient({
  funnels,
  conversions,
  dailyStats,
  trackingLinks,
  summary,
}: ResultsDashboardClientProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount);
  };

  const { last7DaysRevenue, previousRevenue, revenueChange } = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const last7Days = dailyStats.filter(
      (s) => new Date(s.date) >= sevenDaysAgo
    );
    const previous7Days = dailyStats.filter(
      (s) => new Date(s.date) >= fourteenDaysAgo && new Date(s.date) < sevenDaysAgo
    );

    const last7DaysRevenue = last7Days.reduce((sum, s) => sum + s.revenue, 0);
    const previousRevenue = previous7Days.reduce((sum, s) => sum + s.revenue, 0);

    const revenueChange = previousRevenue > 0
      ? ((last7DaysRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    return { last7DaysRevenue, previousRevenue, revenueChange };
  }, [dailyStats]);

  const { last7DaysConversions, conversionChange } = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const last7Days = dailyStats.filter(
      (s) => new Date(s.date) >= sevenDaysAgo
    );
    const previous7Days = dailyStats.filter(
      (s) => new Date(s.date) >= fourteenDaysAgo && new Date(s.date) < sevenDaysAgo
    );

    const last7DaysConversions = last7Days.reduce((sum, s) => sum + s.conversions, 0);
    const previousConversions = previous7Days.reduce((sum, s) => sum + s.conversions, 0);

    const conversionChange = previousConversions > 0
      ? ((last7DaysConversions - previousConversions) / previousConversions) * 100
      : 0;

    return { last7DaysConversions, conversionChange };
  }, [dailyStats]);

  const recentConversions = conversions
    .filter((c) => c.event_type === "purchase")
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>総売上</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {revenueChange >= 0 ? (
                <>
                  <ArrowUpRight className="size-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{revenueChange.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="size-3 text-red-500 mr-1" />
                  <span className="text-red-500">{revenueChange.toFixed(1)}%</span>
                </>
              )}
              <span className="ml-1">vs 前週</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>総CV数</CardDescription>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalConversions}件</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {conversionChange >= 0 ? (
                <>
                  <ArrowUpRight className="size-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{conversionChange.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="size-3 text-red-500 mr-1" />
                  <span className="text-red-500">{conversionChange.toFixed(1)}%</span>
                </>
              )}
              <span className="ml-1">vs 前週</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>平均注文単価</CardDescription>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.avgOrderValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>直近7日間売上</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(last7DaysRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conversions">
        <TabsList>
          <TabsTrigger value="conversions">最近のコンバージョン</TabsTrigger>
          <TabsTrigger value="funnels">ファネル分析</TabsTrigger>
          <TabsTrigger value="links">トラッキングリンク</TabsTrigger>
        </TabsList>

        <TabsContent value="conversions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>最近のコンバージョン</CardTitle>
              <CardDescription>直近の購入完了イベント</CardDescription>
            </CardHeader>
            <CardContent>
              {recentConversions.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">コンバージョンがありません</h3>
                  <p className="text-muted-foreground">
                    購入が発生すると、ここに表示されます
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>訪問者ID</TableHead>
                      <TableHead>イベント</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>初回訪問</TableHead>
                      <TableHead>CV日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentConversions.map((conversion) => (
                      <TableRow key={conversion.id}>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {conversion.visitors?.visitor_id?.slice(0, 8) || "-"}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">購入完了</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(conversion.revenue || 0)}
                        </TableCell>
                        <TableCell>
                          {conversion.visitors?.first_seen_at
                            ? new Date(conversion.visitors.first_seen_at).toLocaleDateString("ja-JP")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {new Date(conversion.created_at).toLocaleString("ja-JP")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnels" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>ファネル分析</CardTitle>
              <CardDescription>各ファネルのパフォーマンス</CardDescription>
            </CardHeader>
            <CardContent>
              {funnels.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">ファネルがありません</h3>
                  <p className="text-muted-foreground">
                    ファネルを作成して、コンバージョンを追跡しましょう
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ファネル名</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">ステップ数</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnels.map((funnel) => (
                      <TableRow key={funnel.id}>
                        <TableCell className="font-medium">{funnel.name}</TableCell>
                        <TableCell>
                          <Badge variant={funnel.status === "active" ? "default" : "secondary"}>
                            {funnel.status === "active" ? "有効" : "無効"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {funnel.funnel_steps?.length || 0}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/results/funnels/${funnel.id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            詳細を見る
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>トラッキングリンク</CardTitle>
              <CardDescription>クリック数上位のリンク</CardDescription>
            </CardHeader>
            <CardContent>
              {trackingLinks.length === 0 ? (
                <div className="text-center py-12">
                  <MousePointerClick className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">トラッキングリンクがありません</h3>
                  <p className="text-muted-foreground">
                    トラッキングリンクを作成して、クリックを計測しましょう
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>リンク名</TableHead>
                      <TableHead>ショートコード</TableHead>
                      <TableHead className="text-right">総クリック</TableHead>
                      <TableHead className="text-right">ユニーク</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">{link.name}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {link.short_code}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          {link.total_clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {link.unique_clicks.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
