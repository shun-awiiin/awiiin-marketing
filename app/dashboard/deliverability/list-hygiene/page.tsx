"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { EngagementChart } from "@/components/deliverability";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ListHygieneStatus {
  total_contacts: number;
  active_contacts: number;
  bounced_contacts: number;
  complained_contacts: number;
  unsubscribed_contacts: number;
  high_risk_contacts: number;
  inactive_contacts: number;
  health_percentage: number;
  health_score: number;
  recommendations: Array<{
    type: string;
    contact_count: number;
    description: string;
    impact: "high" | "medium" | "low";
  }>;
}

interface EngagementSummary {
  total_contacts: number;
  distribution: {
    highly_engaged: number;
    engaged: number;
    neutral: number;
    disengaged: number;
    inactive: number;
  };
  average_score: number;
  average_open_rate: number;
  average_click_rate: number;
}

export default function ListHygienePage() {
  const [status, setStatus] = useState<ListHygieneStatus | null>(null);
  const [engagementSummary, setEngagementSummary] = useState<EngagementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuppressing, setIsSuppressing] = useState(false);
  const [suppressPreview, setSuppressPreview] = useState<{
    suppressed_count: number;
    contacts: Array<{ id: string; email: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, engagementRes] = await Promise.all([
        fetch("/api/list-hygiene/status"),
        fetch("/api/engagement/contacts"),
      ]);

      if (statusRes.ok) {
        const { data } = await statusRes.json();
        setStatus(data);
      }

      if (engagementRes.ok) {
        const { data } = await engagementRes.json();
        setEngagementSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewSuppress = async (criteria: {
    risk_level?: string[];
    engagement_level?: string[];
    inactive_days?: number;
  }) => {
    try {
      const response = await fetch("/api/list-hygiene/suppress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria, dry_run: true }),
      });

      if (response.ok) {
        const { data } = await response.json();
        setSuppressPreview(data);
      }
    } catch (error) {
      console.error("Failed to preview suppress:", error);
    }
  };

  const handleConfirmSuppress = async () => {
    setIsSuppressing(true);
    try {
      const response = await fetch("/api/list-hygiene/suppress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: {
            risk_level: ["high", "critical"],
            engagement_level: ["inactive"],
          },
          dry_run: false,
        }),
      });

      if (response.ok) {
        await fetchData();
        setSuppressPreview(null);
      }
    } catch (error) {
      console.error("Failed to suppress:", error);
    } finally {
      setIsSuppressing(false);
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
          <h1 className="text-2xl font-bold">リスト衛生管理</h1>
          <p className="text-muted-foreground">
            連絡先リストの品質を管理し、配信品質を向上させます
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          更新
        </Button>
      </div>

      {status && (
        <>
          {/* Health Score */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">リスト健全性スコア</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl",
                      status.health_score >= 80 && "bg-green-500",
                      status.health_score >= 60 && status.health_score < 80 && "bg-yellow-500",
                      status.health_score < 60 && "bg-red-500"
                    )}
                  >
                    {status.health_score}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">
                      {status.active_contacts.toLocaleString()}件のアクティブコンタクト
                    </p>
                    <Progress value={status.health_percentage} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">コンタクト内訳</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-green-50 rounded text-center">
                    <p className="text-xl font-bold text-green-700">
                      {status.active_contacts.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">アクティブ</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded text-center">
                    <p className="text-xl font-bold text-red-700">
                      {status.bounced_contacts}
                    </p>
                    <p className="text-xs text-muted-foreground">バウンス</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded text-center">
                    <p className="text-xl font-bold text-orange-700">
                      {status.high_risk_contacts}
                    </p>
                    <p className="text-xs text-muted-foreground">高リスク</p>
                  </div>
                  <div className="p-2 bg-yellow-50 rounded text-center">
                    <p className="text-xl font-bold text-yellow-700">
                      {status.inactive_contacts}
                    </p>
                    <p className="text-xs text-muted-foreground">非活発</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Chart */}
          {engagementSummary && <EngagementChart summary={engagementSummary} />}

          {/* Recommendations */}
          {status.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  推奨アクション
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {status.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg",
                      rec.impact === "high" && "bg-red-50",
                      rec.impact === "medium" && "bg-yellow-50",
                      rec.impact === "low" && "bg-blue-50"
                    )}
                  >
                    <div>
                      <p className="font-medium">{rec.description}</p>
                      <p className="text-sm text-muted-foreground">
                        対象: {rec.contact_count}件
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        rec.impact === "high" && "bg-red-100 text-red-700",
                        rec.impact === "medium" && "bg-yellow-100 text-yellow-700",
                        rec.impact === "low" && "bg-blue-100 text-blue-700"
                      )}
                    >
                      {rec.impact === "high" ? "優先度高" : rec.impact === "medium" ? "優先度中" : "優先度低"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Suppress Actions */}
          {(status.high_risk_contacts > 0 || status.inactive_contacts > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">クリーンアップアクション</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.high_risk_contacts > 0 && (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">高リスクコンタクトを抑制</p>
                      <p className="text-sm text-muted-foreground">
                        {status.high_risk_contacts}件の高リスクメールアドレスを送信対象から除外します
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handlePreviewSuppress({
                              risk_level: ["high", "critical"],
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          抑制
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>コンタクトを抑制しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            {suppressPreview
                              ? `${suppressPreview.suppressed_count}件のコンタクトが送信対象から除外されます。この操作は取り消せます。`
                              : "プレビューを読み込み中..."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleConfirmSuppress}
                            disabled={isSuppressing}
                          >
                            {isSuppressing && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            実行
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
