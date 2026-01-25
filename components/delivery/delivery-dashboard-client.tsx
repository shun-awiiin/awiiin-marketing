"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { Plus, Mail, MessageSquare, PlayCircle, Send, Users } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  scheduled_at: string | null;
  created_at: string;
}

interface Scenario {
  id: string;
  name: string;
  status: string;
  scenario_steps: { id: string }[];
  scenario_enrollments: { id: string; status: string }[];
  created_at: string;
}

interface LineBroadcast {
  id: string;
  title: string;
  status: string;
  sent_count: number;
  scheduled_at: string | null;
  created_at: string;
}

interface DeliveryDashboardClientProps {
  campaigns: Campaign[];
  scenarios: Scenario[];
  lineBroadcasts: LineBroadcast[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "下書き", variant: "secondary" },
  scheduled: { label: "予約済", variant: "outline" },
  sending: { label: "配信中", variant: "default" },
  sent: { label: "配信済", variant: "default" },
  active: { label: "稼働中", variant: "default" },
  paused: { label: "一時停止", variant: "secondary" },
  completed: { label: "完了", variant: "outline" },
};

export function DeliveryDashboardClient({
  campaigns,
  scenarios,
  lineBroadcasts,
}: DeliveryDashboardClientProps) {
  const activeScenariosCount = scenarios.filter((s) => s.status === "active").length;
  const activeEnrollmentsCount = scenarios.reduce(
    (sum, s) => sum + s.scenario_enrollments.filter((e) => e.status === "active").length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>アクティブシナリオ</CardDescription>
            <CardTitle className="text-2xl">{activeScenariosCount}件</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>シナリオ受講者</CardDescription>
            <CardTitle className="text-2xl">{activeEnrollmentsCount}人</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>予約配信</CardDescription>
            <CardTitle className="text-2xl">
              {campaigns.filter((c) => c.status === "scheduled").length +
                lineBroadcasts.filter((b) => b.status === "scheduled").length}
              件
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="size-4" />
            メール
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <PlayCircle className="size-4" />
            シナリオ
          </TabsTrigger>
          <TabsTrigger value="line" className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            LINE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>メールキャンペーン</CardTitle>
                <CardDescription>アクティブなキャンペーン</CardDescription>
              </div>
              <Link href="/dashboard/campaigns/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  新規作成
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">キャンペーンがありません</h3>
                  <p className="text-muted-foreground mb-4">
                    メールキャンペーンを作成して配信を開始しましょう
                  </p>
                  <Link href="/dashboard/campaigns/new">
                    <Button>
                      <Plus className="size-4 mr-2" />
                      キャンペーンを作成
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>キャンペーン名</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">配信数</TableHead>
                      <TableHead className="text-right">開封率</TableHead>
                      <TableHead className="text-right">クリック率</TableHead>
                      <TableHead>配信日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => {
                      const status = statusLabels[campaign.status] || statusLabels.draft;
                      const openRate = campaign.sent_count > 0
                        ? ((campaign.open_count / campaign.sent_count) * 100).toFixed(1)
                        : "0.0";
                      const clickRate = campaign.sent_count > 0
                        ? ((campaign.click_count / campaign.sent_count) * 100).toFixed(1)
                        : "0.0";

                      return (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{campaign.name}</div>
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {campaign.subject}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {campaign.sent_count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">{openRate}%</TableCell>
                          <TableCell className="text-right">{clickRate}%</TableCell>
                          <TableCell>
                            {campaign.scheduled_at
                              ? new Date(campaign.scheduled_at).toLocaleString("ja-JP")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>シナリオ配信</CardTitle>
                <CardDescription>ステップメール・自動配信</CardDescription>
              </div>
              <Link href="/dashboard/scenarios/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  新規作成
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {scenarios.length === 0 ? (
                <div className="text-center py-12">
                  <PlayCircle className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">シナリオがありません</h3>
                  <p className="text-muted-foreground mb-4">
                    ステップメールを作成して自動配信を始めましょう
                  </p>
                  <Link href="/dashboard/scenarios/new">
                    <Button>
                      <Plus className="size-4 mr-2" />
                      シナリオを作成
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>シナリオ名</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">ステップ数</TableHead>
                      <TableHead className="text-right">受講者数</TableHead>
                      <TableHead>作成日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarios.map((scenario) => {
                      const status = statusLabels[scenario.status] || statusLabels.draft;
                      const activeEnrollments = scenario.scenario_enrollments.filter(
                        (e) => e.status === "active"
                      ).length;

                      return (
                        <TableRow key={scenario.id}>
                          <TableCell className="font-medium">{scenario.name}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {scenario.scenario_steps.length}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Users className="size-4 text-muted-foreground" />
                              {activeEnrollments}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(scenario.created_at).toLocaleDateString("ja-JP")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="line" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>LINE配信</CardTitle>
                <CardDescription>LINE一斉配信</CardDescription>
              </div>
              <Link href="/dashboard/line/broadcast/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  新規作成
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {lineBroadcasts.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">LINE配信がありません</h3>
                  <p className="text-muted-foreground mb-4">
                    LINE公式アカウントを連携して配信を始めましょう
                  </p>
                  <Link href="/dashboard/settings/line">
                    <Button variant="outline">
                      <MessageSquare className="size-4 mr-2" />
                      LINE連携設定
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">配信数</TableHead>
                      <TableHead>配信日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineBroadcasts.map((broadcast) => {
                      const status = statusLabels[broadcast.status] || statusLabels.draft;

                      return (
                        <TableRow key={broadcast.id}>
                          <TableCell className="font-medium">{broadcast.title}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {broadcast.sent_count.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {broadcast.scheduled_at
                              ? new Date(broadcast.scheduled_at).toLocaleString("ja-JP")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
