import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  Shield,
  Users,
  Activity,
  TrendingUp,
  FileText,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  DeliverabilityScoreCard,
  FactorBreakdown,
  ContentAnalyzer,
} from "@/components/deliverability";

async function getDeliverabilityData(userId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/reputation/score?full=true`,
      {
        headers: {
          Cookie: `sb-access-token=${userId}`,
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      const { data } = await response.json();
      return data;
    }
  } catch (error) {
    console.error("Failed to fetch deliverability data:", error);
  }

  // Return default data
  return {
    score: {
      overall_score: 75,
      grade: "C" as const,
      factors: {
        domain_health: { score: 70, weight: 0.25, weighted_score: 17, status: "fair" as const, details: [] },
        list_quality: { score: 80, weight: 0.25, weighted_score: 20, status: "good" as const, details: [] },
        engagement: { score: 65, weight: 0.20, weighted_score: 13, status: "fair" as const, details: [] },
        reputation: { score: 85, weight: 0.20, weighted_score: 17, status: "good" as const, details: [] },
        content: { score: 75, weight: 0.10, weighted_score: 8, status: "good" as const, details: [] },
      },
      recommendations: [],
      last_updated: new Date().toISOString(),
    },
    alerts: [],
  };
}

export default async function DeliverabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const data = await getDeliverabilityData(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">配信品質</h1>
          <p className="text-muted-foreground">
            メール配信品質を監視し、改善点を確認できます
          </p>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              アラート
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.map((alert: { id: string; title: string; message: string }) => (
              <div key={alert.id} className="text-sm text-orange-700">
                <span className="font-medium">{alert.title}:</span> {alert.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Score Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <DeliverabilityScoreCard
          score={data.score.overall_score}
          grade={data.score.grade}
          className="lg:col-span-1"
        />
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">クイックナビゲーション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard/deliverability/domain-health">
                <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="font-medium text-sm">ドメイン認証</p>
                </div>
              </Link>
              <Link href="/dashboard/deliverability/list-hygiene">
                <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium text-sm">リスト衛生</p>
                </div>
              </Link>
              <Link href="/dashboard/deliverability/reputation">
                <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <p className="font-medium text-sm">レピュテーション</p>
                </div>
              </Link>
              <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center cursor-pointer" onClick={() => {}}>
                <FileText className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <p className="font-medium text-sm">コンテンツ</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factor Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">スコア内訳</CardTitle>
        </CardHeader>
        <CardContent>
          <FactorBreakdown factors={data.score.factors} />
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data.score.recommendations && data.score.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">優先度の高い改善項目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.score.recommendations.map(
                (rec: {
                  priority: number;
                  title: string;
                  description: string;
                  action_url?: string;
                }, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {rec.priority}
                      </span>
                      <div>
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                    {rec.action_url && (
                      <Link href={rec.action_url}>
                        <Button variant="outline" size="sm">
                          対応する
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Analyzer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">コンテンツ分析ツール</CardTitle>
        </CardHeader>
        <CardContent>
          <ContentAnalyzer />
        </CardContent>
      </Card>
    </div>
  );
}
