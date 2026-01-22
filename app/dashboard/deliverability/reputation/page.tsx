"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw } from "lucide-react";
import { ReputationTrendChart, ReputationStats } from "@/components/deliverability";

interface ReputationMetrics {
  date: string;
  delivery_rate: number;
  bounce_rate: number;
  complaint_rate: number;
  open_rate: number;
  click_rate: number;
  total_sent: number;
}

interface ReputationSummary {
  domain: string;
  period: "7d" | "30d" | "90d";
  total_sent: number;
  avg_delivery_rate: number;
  avg_bounce_rate: number;
  avg_complaint_rate: number;
  avg_open_rate: number;
  avg_click_rate: number;
  trend: {
    delivery_rate: "up" | "down" | "stable";
    bounce_rate: "up" | "down" | "stable";
    complaint_rate: "up" | "down" | "stable";
  };
  risk_level: "healthy" | "warning" | "critical";
  daily_metrics: ReputationMetrics[];
}

export default function ReputationPage() {
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reputation/metrics?period=${period}`);
      if (response.ok) {
        const { data } = await response.json();
        setSummary(data.summary || {
          domain: "",
          period,
          total_sent: 0,
          avg_delivery_rate: 0,
          avg_bounce_rate: 0,
          avg_complaint_rate: 0,
          avg_open_rate: 0,
          avg_click_rate: 0,
          trend: {
            delivery_rate: "stable" as const,
            bounce_rate: "stable" as const,
            complaint_rate: "stable" as const,
          },
          risk_level: "healthy" as const,
          daily_metrics: data.metrics || [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch reputation data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">送信者レピュテーション</h1>
          <p className="text-muted-foreground">
            送信パフォーマンスと配信メトリクスを追跡します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="7d">7日間</TabsTrigger>
              <TabsTrigger value="30d">30日間</TabsTrigger>
              <TabsTrigger value="90d">90日間</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {summary && (
        <>
          {/* Trend Chart */}
          <ReputationTrendChart summary={summary} />

          {/* Detailed Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">詳細メトリクス</CardTitle>
            </CardHeader>
            <CardContent>
              <ReputationStats summary={summary} />
            </CardContent>
          </Card>

          {/* Thresholds Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">推奨しきい値</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">バウンス率</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-600">優秀</span>
                      <span>&lt; 2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">注意</span>
                      <span>2-5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">危険</span>
                      <span>&gt; 5%</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">苦情率</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-600">優秀</span>
                      <span>&lt; 0.05%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">注意</span>
                      <span>0.05-0.1%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">危険</span>
                      <span>&gt; 0.1%</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">配信率</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-600">優秀</span>
                      <span>&gt; 98%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">注意</span>
                      <span>95-98%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">危険</span>
                      <span>&lt; 95%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">レピュテーション向上のヒント</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">バウンス率を下げるには</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>コンタクトリストを定期的に検証する</li>
                    <li>ダブルオプトインを使用する</li>
                    <li>古いコンタクトを定期的にクリーンアップする</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">苦情率を下げるには</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>明確な配信停止リンクを含める</li>
                    <li>送信頻度を適切に管理する</li>
                    <li>セグメンテーションを活用する</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
