"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  CreditCard,
  Heart,
  Send,
  Users,
  BarChart3,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface FunnelSetupStatus {
  hasLP: boolean;
  hasProduct: boolean;
  hasThankYouPage: boolean;
  hasCampaign: boolean;
  hasAffiliate: boolean;
}

interface StepBarProps {
  status?: FunnelSetupStatus;
}

const steps = [
  {
    id: "lp",
    title: "LP",
    fullTitle: "ランディングページを作成",
    description: "AIでLPを自動生成",
    icon: FileText,
    href: "/dashboard/lp/new",
    checkKey: "hasLP" as keyof FunnelSetupStatus,
  },
  {
    id: "payment",
    title: "決済",
    fullTitle: "商品を作成",
    description: "Stripe決済を設定",
    icon: CreditCard,
    href: "/dashboard/payment/products/new",
    checkKey: "hasProduct" as keyof FunnelSetupStatus,
  },
  {
    id: "thanks",
    title: "サンクス",
    fullTitle: "サンクスページを作成",
    description: "購入後の案内ページ",
    icon: Heart,
    href: "/dashboard/thank-you/new",
    checkKey: "hasThankYouPage" as keyof FunnelSetupStatus,
  },
  {
    id: "delivery",
    title: "配信",
    fullTitle: "配信シナリオを作成",
    description: "メール・LINE配信",
    icon: Send,
    href: "/dashboard/scenarios/new",
    checkKey: "hasCampaign" as keyof FunnelSetupStatus,
  },
  {
    id: "referral",
    title: "紹介",
    fullTitle: "アフィリエイトを設定",
    description: "紹介プログラム開始",
    icon: Users,
    href: "/dashboard/referral/settings",
    checkKey: "hasAffiliate" as keyof FunnelSetupStatus,
  },
  {
    id: "results",
    title: "結果",
    fullTitle: "結果を確認",
    description: "コンバージョン分析",
    icon: BarChart3,
    href: "/dashboard/results",
    checkKey: null,
  },
];

export function StepBar({ status }: StepBarProps) {
  const pathname = usePathname();

  const { currentStepIndex, nextStep, completedCount } = useMemo(() => {
    if (!status) {
      return { currentStepIndex: 0, nextStep: steps[0], completedCount: 0 };
    }

    let completedCount = 0;
    let firstIncompleteIndex = steps.length - 1;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.checkKey && status[step.checkKey]) {
        completedCount++;
      } else if (step.checkKey && !status[step.checkKey]) {
        if (firstIncompleteIndex === steps.length - 1) {
          firstIncompleteIndex = i;
        }
      }
    }

    return {
      currentStepIndex: firstIncompleteIndex,
      nextStep: steps[firstIncompleteIndex],
      completedCount,
    };
  }, [status]);

  const allCompleted = status && completedCount >= 5;

  return (
    <div className="bg-muted/50 border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            セットアップ進捗
          </span>
          <span className="text-sm font-bold text-primary">
            {completedCount}/5
          </span>
        </div>
        {!allCompleted && nextStep && (
          <Link
            href={nextStep.href}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            次にやること: {nextStep.fullTitle}
            <ChevronRight className="size-4" />
          </Link>
        )}
        {allCompleted && (
          <span className="flex items-center gap-2 text-sm font-medium text-green-600">
            <CheckCircle2 className="size-4" />
            セットアップ完了
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {steps.map((step, index) => {
          const isCompleted = step.checkKey && status?.[step.checkKey];
          const isCurrent = index === currentStepIndex && !allCompleted;
          const isActive = pathname.includes(`/dashboard/${step.id === "thanks" ? "thank-you" : step.id}`);

          return (
            <div key={step.id} className="flex items-center flex-1">
              <Link
                href={step.href.replace("/new", "").replace("/settings", "")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md flex-1 transition-colors",
                  isCompleted && "bg-green-100 text-green-700",
                  isCurrent && !isCompleted && "bg-primary/10 text-primary border-2 border-primary",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                  isActive && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <step.icon className="size-4 shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{step.title}</span>
              </Link>
              {index < steps.length - 1 && (
                <ChevronRight className="size-4 text-muted-foreground shrink-0 mx-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
