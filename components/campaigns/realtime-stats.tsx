"use client";

/**
 * Realtime Stats Component
 * Displays live campaign statistics with real-time updates
 */

import { useRealtimeStats } from "@/lib/hooks/use-realtime-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RealtimeStatsProps {
  campaignId: string;
  campaignStatus: string;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: number;
  color?: "default" | "green" | "red" | "orange" | "blue";
  icon?: React.ReactNode;
}

function StatCard({ label, value, color = "default", icon }: StatCardProps) {
  const colorClasses = {
    default: "",
    green: "text-green-600",
    red: "text-red-600",
    orange: "text-orange-600",
    blue: "text-blue-600",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", colorClasses[color])}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}

export function RealtimeStats({
  campaignId,
  campaignStatus,
  className,
}: RealtimeStatsProps) {
  // Only enable realtime for active campaigns
  const isActive = ["sending", "queued"].includes(campaignStatus);
  const { stats, isConnected, isLoading, error, refetch } = useRealtimeStats(
    campaignId,
    { enabled: true, refreshInterval: isActive ? 5000 : 30000 }
  );

  if (isLoading) {
    return <StatsLoading />;
  }

  if (error || !stats) {
    return (
      <Card className={cn("border-red-200 bg-red-50", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>統計情報の読み込みに失敗しました</span>
            <button
              onClick={() => refetch()}
              className="ml-2 text-sm underline hover:no-underline"
            >
              再試行
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completed = stats.sent + stats.delivered + stats.failed + stats.bounced + stats.complained;
  const progress = stats.total > 0 ? (completed / stats.total) * 100 : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && (
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className={cn(
                "gap-1",
                isConnected ? "bg-green-100 text-green-700" : ""
              )}
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  リアルタイム接続中
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  オフライン
                </>
              )}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          最終更新: {stats.last_updated.toLocaleTimeString("ja-JP")}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="総送信数"
          value={stats.total}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="送信完了"
          value={stats.sent + stats.delivered}
          color="green"
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          label="失敗/バウンス"
          value={stats.failed + stats.bounced}
          color="red"
          icon={<XCircle className="h-4 w-4" />}
        />
        <StatCard
          label="到達率"
          value={
            stats.total > 0
              ? Math.round(((stats.delivered || stats.sent) / stats.total) * 100)
              : 0
          }
          color="blue"
          icon={<span className="text-xs">%</span>}
        />
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              送信進捗
              {isActive && isConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-muted-foreground">
                {completed.toLocaleString()} / {stats.total.toLocaleString()} 完了
                ({progress.toFixed(1)}%)
              </p>
              {stats.queued > 0 && (
                <p className="text-xs text-muted-foreground">
                  残り {stats.queued.toLocaleString()} 件
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Stats */}
      {(stats.bounced > 0 || stats.complained > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <div className="flex gap-4">
                {stats.bounced > 0 && (
                  <span>
                    バウンス: {stats.bounced} 件 ({stats.bounce_rate.toFixed(2)}%)
                  </span>
                )}
                {stats.complained > 0 && (
                  <span className="text-red-600">
                    苦情: {stats.complained} 件 ({stats.complaint_rate.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
