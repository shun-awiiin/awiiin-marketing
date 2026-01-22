"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

interface ReputationTrendChartProps {
  summary: ReputationSummary;
}

const riskLevelConfig = {
  healthy: { label: "健全", color: "bg-green-100 text-green-700" },
  warning: { label: "注意", color: "bg-yellow-100 text-yellow-700" },
  critical: { label: "危険", color: "bg-red-100 text-red-700" },
};

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (trend === "down") {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-500" />;
}

export function ReputationTrendChart({ summary }: ReputationTrendChartProps) {
  const riskConfig = riskLevelConfig[summary.risk_level];

  // Simple bar chart using CSS
  const maxSent = Math.max(...summary.daily_metrics.map((m) => m.total_sent), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">
            {summary.domain || "全ドメイン"} - {summary.period}間のレピュテーション
          </span>
          <Badge className={cn(riskConfig.color)}>{riskConfig.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard
            label="配信率"
            value={`${summary.avg_delivery_rate.toFixed(1)}%`}
            trend={summary.trend.delivery_rate}
            isGood={summary.avg_delivery_rate >= 95}
          />
          <MetricCard
            label="バウンス率"
            value={`${summary.avg_bounce_rate.toFixed(2)}%`}
            trend={summary.trend.bounce_rate}
            isGood={summary.avg_bounce_rate < 2}
            invertTrend
          />
          <MetricCard
            label="苦情率"
            value={`${summary.avg_complaint_rate.toFixed(3)}%`}
            trend={summary.trend.complaint_rate}
            isGood={summary.avg_complaint_rate < 0.05}
            invertTrend
          />
          <MetricCard
            label="開封率"
            value={`${summary.avg_open_rate.toFixed(1)}%`}
            isGood={summary.avg_open_rate >= 20}
          />
          <MetricCard
            label="クリック率"
            value={`${summary.avg_click_rate.toFixed(1)}%`}
            isGood={summary.avg_click_rate >= 2}
          />
        </div>

        {/* Volume Chart */}
        {summary.daily_metrics.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">送信ボリューム</h4>
            <div className="flex items-end gap-1 h-24">
              {summary.daily_metrics.slice(-14).map((metric, index) => {
                const height = (metric.total_sent / maxSent) * 100;
                return (
                  <div
                    key={index}
                    className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-colors"
                    style={{ height: `${height}%` }}
                    title={`${metric.date}: ${metric.total_sent}通`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {summary.daily_metrics[0]?.date
                  ? new Date(summary.daily_metrics[0].date).toLocaleDateString(
                      "ja-JP",
                      { month: "short", day: "numeric" }
                    )
                  : ""}
              </span>
              <span>
                {summary.daily_metrics[summary.daily_metrics.length - 1]?.date
                  ? new Date(
                      summary.daily_metrics[summary.daily_metrics.length - 1].date
                    ).toLocaleDateString("ja-JP", {
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </span>
            </div>
          </div>
        )}

        {/* Total Sent */}
        <div className="text-center pt-4 border-t">
          <p className="text-3xl font-bold">{summary.total_sent.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">期間中の総送信数</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  trend?: "up" | "down" | "stable";
  isGood?: boolean;
  invertTrend?: boolean;
}

function MetricCard({
  label,
  value,
  trend,
  isGood = true,
  invertTrend = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg text-center",
        isGood ? "bg-green-50" : "bg-red-50"
      )}
    >
      <div className="flex items-center justify-center gap-1">
        <span
          className={cn("text-xl font-bold", isGood ? "text-green-700" : "text-red-700")}
        >
          {value}
        </span>
        {trend && <TrendIcon trend={invertTrend ? (trend === "up" ? "down" : trend === "down" ? "up" : "stable") : trend} />}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

interface ReputationStatsProps {
  summary: ReputationSummary;
}

export function ReputationStats({ summary }: ReputationStatsProps) {
  const stats = [
    {
      label: "配信率",
      value: summary.avg_delivery_rate,
      format: (v: number) => `${v.toFixed(1)}%`,
      threshold: 95,
      warning: 90,
    },
    {
      label: "バウンス率",
      value: summary.avg_bounce_rate,
      format: (v: number) => `${v.toFixed(2)}%`,
      threshold: 2,
      warning: 3,
      invert: true,
    },
    {
      label: "苦情率",
      value: summary.avg_complaint_rate,
      format: (v: number) => `${v.toFixed(3)}%`,
      threshold: 0.05,
      warning: 0.1,
      invert: true,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => {
        const isGood = stat.invert
          ? stat.value <= stat.threshold
          : stat.value >= stat.threshold;
        const isWarning = stat.invert
          ? stat.value > stat.threshold && stat.value <= stat.warning
          : stat.value < stat.threshold && stat.value >= stat.warning;

        return (
          <div
            key={stat.label}
            className={cn(
              "p-4 rounded-lg text-center",
              isGood && "bg-green-50",
              isWarning && "bg-yellow-50",
              !isGood && !isWarning && "bg-red-50"
            )}
          >
            <p className="text-2xl font-bold">{stat.format(stat.value)}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
