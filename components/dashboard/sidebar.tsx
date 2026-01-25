"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  Settings,
  LogOut,
  ChevronUp,
  MessageSquare,
  Youtube,
  Instagram,
  MessageCircle,
  Shield,
  FileText,
  CreditCard,
  Heart,
  Send,
  Users,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import { XIcon } from "@/components/icons/x-icon";

const funnelMenuItems = [
  {
    title: "LP",
    icon: FileText,
    href: "/dashboard/lp",
    matchPaths: ["/dashboard/lp"],
    description: "ランディングページ",
  },
  {
    title: "決済",
    icon: CreditCard,
    href: "/dashboard/payment",
    matchPaths: ["/dashboard/payment"],
    description: "商品・決済管理",
  },
  {
    title: "サンクス",
    icon: Heart,
    href: "/dashboard/thank-you",
    matchPaths: ["/dashboard/thank-you"],
    description: "サンクスページ",
  },
  {
    title: "配信",
    icon: Send,
    href: "/dashboard/delivery",
    matchPaths: ["/dashboard/delivery", "/dashboard/campaigns", "/dashboard/scenarios"],
    description: "メール・LINE配信",
  },
  {
    title: "紹介",
    icon: Users,
    href: "/dashboard/referral",
    matchPaths: ["/dashboard/referral"],
    description: "アフィリエイト",
  },
  {
    title: "結果",
    icon: BarChart3,
    href: "/dashboard/results",
    matchPaths: ["/dashboard/results"],
    description: "コンバージョン分析",
  },
];

const contentMenuItems = [
  {
    title: "コース",
    icon: GraduationCap,
    href: "/dashboard/courses",
    matchPaths: ["/dashboard/courses"],
  },
];

const channelMenuItems = [
  {
    title: "メールマーケティング",
    icon: Mail,
    href: "/dashboard",
    matchPaths: [
      "/dashboard",
      "/dashboard/segments",
      "/dashboard/contacts",
      "/dashboard/tags",
      "/dashboard/templates",
      "/dashboard/deliverability",
      "/dashboard/analytics",
    ],
  },
  {
    title: "LINE",
    icon: MessageSquare,
    href: "/dashboard/line",
    matchPaths: ["/dashboard/line"],
  },
  {
    title: "YouTube",
    icon: Youtube,
    href: "/dashboard/youtube",
    matchPaths: ["/dashboard/youtube"],
  },
  {
    title: "X",
    icon: XIcon,
    href: "/dashboard/x",
    matchPaths: ["/dashboard/x"],
  },
  {
    title: "Instagram",
    icon: Instagram,
    href: "/dashboard/instagram",
    matchPaths: ["/dashboard/instagram"],
  },
  {
    title: "WhatsApp",
    icon: MessageCircle,
    href: "/dashboard/whatsapp",
    matchPaths: ["/dashboard/whatsapp"],
  },
];

interface DashboardSidebarProps {
  user: User;
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Mail className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">MailFlow</span>
                  <span className="text-xs text-muted-foreground">
                    メール配信管理
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>ファネル</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {funnelMenuItems.map((item) => {
                const isActive = item.matchPaths.some(
                  (path) => pathname === path || pathname.startsWith(path + "/")
                );
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>コンテンツ</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentMenuItems.map((item) => {
                const isActive = item.matchPaths.some(
                  (path) => pathname === path || pathname.startsWith(path + "/")
                );
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>チャネル</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channelMenuItems.map((item) => {
                const isActive = item.matchPaths.some(
                  (path) => pathname === path || pathname.startsWith(path + "/")
                );
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>設定</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/settings/line"}
                >
                  <Link href="/dashboard/settings/line">
                    <MessageSquare className="size-4" />
                    <span>LINE連携</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/settings/dns"}
                >
                  <Link href="/dashboard/settings/dns">
                    <Shield className="size-4" />
                    <span>DNS設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/settings"}
                >
                  <Link href="/dashboard/settings">
                    <Settings className="size-4" />
                    <span>設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 size-4" />
                    設定
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 size-4" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
