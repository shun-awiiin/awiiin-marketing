"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Shield,
  Users,
  Activity,
  TrendingUp,
  FileText,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface FactorScore {
  score: number;
  weight: number;
  weighted_score: number;
  status: "excellent" | "good" | "fair" | "poor" | "critical";
  details: string[];
}

interface FactorBreakdownProps {
  factors: {
    domain_health: FactorScore;
    list_quality: FactorScore;
    engagement: FactorScore;
    reputation: FactorScore;
    content: FactorScore;
  };
}

const factorConfig = {
  domain_health: {
    label: "ドメイン認証",
    icon: Shield,
    href: "/dashboard/deliverability/domain-health",
    description: "SPF、DKIM、DMARC設定",
  },
  list_quality: {
    label: "リスト品質",
    icon: Users,
    href: "/dashboard/deliverability/list-hygiene",
    description: "連絡先リストの健全性",
  },
  engagement: {
    label: "エンゲージメント",
    icon: Activity,
    href: "/dashboard/deliverability/list-hygiene",
    description: "開封率・クリック率",
  },
  reputation: {
    label: "送信者レピュテーション",
    icon: TrendingUp,
    href: "/dashboard/deliverability/reputation",
    description: "バウンス率・苦情率",
  },
  content: {
    label: "コンテンツ品質",
    icon: FileText,
    href: "/dashboard/deliverability",
    description: "スパムスコア・リンク",
  },
};

const statusColors = {
  excellent: { bg: "bg-green-100", text: "text-green-700", badge: "成績優秀" },
  good: { bg: "bg-blue-100", text: "text-blue-700", badge: "良好" },
  fair: { bg: "bg-yellow-100", text: "text-yellow-700", badge: "普通" },
  poor: { bg: "bg-orange-100", text: "text-orange-700", badge: "要改善" },
  critical: { bg: "bg-red-100", text: "text-red-700", badge: "要対応" },
};

export function FactorBreakdown({ factors }: FactorBreakdownProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {(Object.entries(factors) as [keyof typeof factors, FactorScore][]).map(
        ([key, factor]) => {
          const config = factorConfig[key];
          const colors = statusColors[factor.status];
          const Icon = config.icon;

          return (
            <Link key={key} href={config.href}>
              <Card
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  factor.status === "critical" && "border-red-200"
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{config.label}</span>
                    </div>
                    <Badge className={cn(colors.bg, colors.text, "text-xs")}>
                      {colors.badge}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{factor.score}</span>
                      <span className="text-xs text-muted-foreground">
                        重み: {Math.round(factor.weight * 100)}%
                      </span>
                    </div>
                    <Progress value={factor.score} className="h-2" />
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {factor.details[0] || config.description}
                    </p>
                    <div className="flex items-center text-xs text-primary">
                      <span>詳細を見る</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        }
      )}
    </div>
  );
}

interface FactorListProps {
  factors: FactorBreakdownProps["factors"];
}

export function FactorList({ factors }: FactorListProps) {
  return (
    <div className="space-y-3">
      {(Object.entries(factors) as [keyof typeof factors, FactorScore][]).map(
        ([key, factor]) => {
          const config = factorConfig[key];
          const colors = statusColors[factor.status];
          const Icon = config.icon;

          return (
            <div
              key={key}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{config.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{factor.score}</span>
                <Badge className={cn(colors.bg, colors.text, "text-xs")}>
                  {colors.badge}
                </Badge>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}
