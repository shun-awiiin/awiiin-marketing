"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface DeliverabilityScoreCardProps {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  trend?: "up" | "down" | "stable";
  className?: string;
}

const gradeColors = {
  A: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-500" },
  B: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-500" },
  C: { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-500" },
  D: { bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-500" },
  F: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-500" },
};

const gradeLabels = {
  A: "優秀",
  B: "良好",
  C: "普通",
  D: "要改善",
  F: "危険",
};

export function DeliverabilityScoreCard({
  score,
  grade,
  trend,
  className,
}: DeliverabilityScoreCardProps) {
  const colors = gradeColors[grade];

  return (
    <Card className={cn(colors.bg, className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>配信品質スコア</span>
          {trend && (
            <span className="flex items-center text-xs">
              {trend === "up" && (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              )}
              {trend === "down" && (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center w-20 h-20 rounded-full text-white font-bold text-3xl",
              colors.badge
            )}
          >
            {grade}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold", colors.text)}>
                {score}
              </span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <Badge variant="outline" className={cn("mt-1", colors.text)}>
              {gradeLabels[grade]}
            </Badge>
            <Progress value={score} className="mt-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ScoreGauge({ score, size = "md", showLabel = true }: ScoreGaugeProps) {
  const getColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 30) return "text-orange-500";
    return "text-red-500";
  };

  const getIcon = (score: number) => {
    if (score >= 70) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (score >= 50) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const sizeClasses = {
    sm: "w-12 h-12 text-sm",
    md: "w-16 h-16 text-lg",
    lg: "w-24 h-24 text-2xl",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "rounded-full border-4 flex items-center justify-center font-bold",
          sizeClasses[size],
          getColor(score)
        )}
        style={{
          borderColor: `hsl(${score * 1.2}, 70%, 50%)`,
        }}
      >
        {score}
      </div>
      {showLabel && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {getIcon(score)}
        </div>
      )}
    </div>
  );
}
