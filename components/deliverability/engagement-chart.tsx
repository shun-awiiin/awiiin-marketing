"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EngagementDistribution {
  highly_engaged: number;
  engaged: number;
  neutral: number;
  disengaged: number;
  inactive: number;
}

interface EngagementSummary {
  total_contacts: number;
  distribution: EngagementDistribution;
  average_score: number;
  average_open_rate: number;
  average_click_rate: number;
}

interface EngagementChartProps {
  summary: EngagementSummary;
}

const levelConfig = {
  highly_engaged: {
    label: "非常に活発",
    color: "bg-green-500",
    textColor: "text-green-700",
    bgLight: "bg-green-100",
  },
  engaged: {
    label: "活発",
    color: "bg-blue-500",
    textColor: "text-blue-700",
    bgLight: "bg-blue-100",
  },
  neutral: {
    label: "普通",
    color: "bg-gray-500",
    textColor: "text-gray-700",
    bgLight: "bg-gray-100",
  },
  disengaged: {
    label: "低調",
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    bgLight: "bg-yellow-100",
  },
  inactive: {
    label: "非活発",
    color: "bg-red-500",
    textColor: "text-red-700",
    bgLight: "bg-red-100",
  },
};

export function EngagementChart({ summary }: EngagementChartProps) {
  const { distribution, total_contacts } = summary;
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  const segments = [
    { key: "highly_engaged" as const, count: distribution.highly_engaged },
    { key: "engaged" as const, count: distribution.engaged },
    { key: "neutral" as const, count: distribution.neutral },
    { key: "disengaged" as const, count: distribution.disengaged },
    { key: "inactive" as const, count: distribution.inactive },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">エンゲージメント分布</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stacked bar chart */}
        <div className="h-8 rounded-full overflow-hidden flex">
          {segments.map(({ key, count }) => {
            const percentage = total > 0 ? (count / total) * 100 : 0;
            if (percentage === 0) return null;

            return (
              <div
                key={key}
                className={cn(levelConfig[key].color, "transition-all")}
                style={{ width: `${percentage}%` }}
                title={`${levelConfig[key].label}: ${count}件 (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {segments.map(({ key, count }) => {
            const config = levelConfig[key];
            const percentage = total > 0 ? (count / total) * 100 : 0;

            return (
              <div
                key={key}
                className={cn(
                  "p-2 rounded-lg text-center",
                  config.bgLight
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <div className={cn("w-3 h-3 rounded-full", config.color)} />
                  <span className={cn("text-xs font-medium", config.textColor)}>
                    {config.label}
                  </span>
                </div>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}%
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.average_score}</p>
            <p className="text-xs text-muted-foreground">平均スコア</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.average_open_rate}%</p>
            <p className="text-xs text-muted-foreground">平均開封率</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.average_click_rate}%</p>
            <p className="text-xs text-muted-foreground">平均クリック率</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EngagementLevelBadgeProps {
  level: keyof typeof levelConfig;
  size?: "sm" | "md";
}

export function EngagementLevelBadge({
  level,
  size = "md",
}: EngagementLevelBadgeProps) {
  const config = levelConfig[level];

  return (
    <Badge
      className={cn(
        config.bgLight,
        config.textColor,
        size === "sm" && "text-xs"
      )}
    >
      <span className={cn("w-2 h-2 rounded-full mr-1", config.color)} />
      {config.label}
    </Badge>
  );
}
