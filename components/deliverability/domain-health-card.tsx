"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

type AuthStatus = "pass" | "fail" | "partial" | "unknown";

interface DomainRecommendation {
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  action?: string;
}

interface DomainHealthRecord {
  domain: string;
  spf_status: AuthStatus;
  dkim_status: AuthStatus;
  dmarc_status: AuthStatus;
  health_score: number;
  recommendations: DomainRecommendation[];
  last_checked_at: string;
}

interface DomainHealthCardProps {
  record: DomainHealthRecord;
  onRecheck?: (domain: string) => void;
  isRechecking?: boolean;
}

const statusConfig = {
  pass: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-100",
    label: "設定済み",
  },
  fail: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-100",
    label: "未設定",
  },
  partial: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-100",
    label: "一部設定",
  },
  unknown: {
    icon: AlertTriangle,
    color: "text-gray-500",
    bg: "bg-gray-100",
    label: "不明",
  },
};

function AuthStatusBadge({ status, label }: { status: AuthStatus; label: string }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge className={cn(config.bg, config.color, "gap-1")}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    </div>
  );
}

export function DomainHealthCard({
  record,
  onRecheck,
  isRechecking,
}: DomainHealthCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{record.domain}</span>
            <span
              className={cn(
                "text-2xl font-bold",
                getScoreColor(record.health_score)
              )}
            >
              {record.health_score}点
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRecheck?.(record.domain)}
            disabled={isRechecking}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1", isRechecking && "animate-spin")}
            />
            再チェック
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auth Status */}
        <div className="grid grid-cols-3 gap-4">
          <AuthStatusBadge status={record.spf_status} label="SPF" />
          <AuthStatusBadge status={record.dkim_status} label="DKIM" />
          <AuthStatusBadge status={record.dmarc_status} label="DMARC" />
        </div>

        {/* Recommendations */}
        {record.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">推奨事項</h4>
            {record.recommendations.slice(0, 3).map((rec, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg text-sm",
                  rec.severity === "critical" && "bg-red-50",
                  rec.severity === "warning" && "bg-yellow-50",
                  rec.severity === "info" && "bg-blue-50"
                )}
              >
                <p className="font-medium">{rec.title}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {rec.description}
                </p>
                {rec.action && (
                  <p className="text-xs mt-2 font-mono bg-white/50 p-2 rounded">
                    {rec.action}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Last checked */}
        <p className="text-xs text-muted-foreground">
          最終チェック:{" "}
          {new Date(record.last_checked_at).toLocaleString("ja-JP")}
        </p>
      </CardContent>
    </Card>
  );
}

interface DomainHealthListProps {
  records: DomainHealthRecord[];
  onRecheck?: (domain: string) => void;
  isRechecking?: boolean;
}

export function DomainHealthList({
  records,
  onRecheck,
  isRechecking,
}: DomainHealthListProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            ドメインが登録されていません。
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            キャンペーンで使用するドメインを追加してチェックを実行してください。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <DomainHealthCard
          key={record.domain}
          record={record}
          onRecheck={onRecheck}
          isRechecking={isRechecking}
        />
      ))}
    </div>
  );
}
