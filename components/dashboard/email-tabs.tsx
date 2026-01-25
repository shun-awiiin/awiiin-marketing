"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Send,
  GitBranch,
  Filter,
  Users,
  Tag,
  FileText,
  Shield,
  BarChart3,
} from "lucide-react";

const emailTabs = [
  {
    title: "ダッシュボード",
    icon: LayoutDashboard,
    href: "/dashboard",
    exact: true,
  },
  {
    title: "キャンペーン",
    icon: Send,
    href: "/dashboard/campaigns",
  },
  {
    title: "シナリオ",
    icon: GitBranch,
    href: "/dashboard/scenarios",
  },
  {
    title: "セグメント",
    icon: Filter,
    href: "/dashboard/segments",
  },
  {
    title: "連絡先",
    icon: Users,
    href: "/dashboard/contacts",
  },
  {
    title: "タグ",
    icon: Tag,
    href: "/dashboard/tags",
  },
  {
    title: "テンプレート",
    icon: FileText,
    href: "/dashboard/templates",
  },
  {
    title: "配信品質",
    icon: Shield,
    href: "/dashboard/deliverability",
  },
  {
    title: "分析",
    icon: BarChart3,
    href: "/dashboard/analytics",
  },
];

// メールマーケティング関連のパスかどうかをチェック
const emailPaths = [
  "/dashboard",
  "/dashboard/campaigns",
  "/dashboard/scenarios",
  "/dashboard/segments",
  "/dashboard/contacts",
  "/dashboard/tags",
  "/dashboard/templates",
  "/dashboard/deliverability",
  "/dashboard/analytics",
];

function isEmailPath(pathname: string): boolean {
  // 他のチャネルとファネル系パスを除外
  const excludedPaths = [
    // チャネル
    "/dashboard/line",
    "/dashboard/youtube",
    "/dashboard/x",
    "/dashboard/instagram",
    "/dashboard/whatsapp",
    "/dashboard/social",
    // ファネル
    "/dashboard/lp",
    "/dashboard/payment",
    "/dashboard/thank-you",
    "/dashboard/delivery",
    "/dashboard/referral",
    "/dashboard/results",
    // コンテンツ
    "/dashboard/courses",
    // 設定
    "/dashboard/settings",
  ];
  if (excludedPaths.some((p) => pathname.startsWith(p))) {
    return false;
  }
  // メール関連のパスかチェック
  return emailPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function EmailTabs() {
  const pathname = usePathname();

  // メール関連のパスでない場合は表示しない
  if (!isEmailPath(pathname)) {
    return null;
  }

  const isActive = (tab: (typeof emailTabs)[number]) => {
    if (tab.exact) {
      return pathname === tab.href;
    }
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex overflow-x-auto scrollbar-hide">
        {emailTabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <tab.icon className="size-4" />
              <span>{tab.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
