"use client";

import { useMemo, useCallback } from "react";
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
  Building2,
  ContactRound,
  FormInput,
  MessagesSquare,
  CalendarDays,
} from "lucide-react";
import { XIcon } from "@/components/icons/x-icon";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";

const crmMenuItems = [
  {
    title: "コンタクト",
    icon: ContactRound,
    href: "/dashboard/contacts",
    matchPaths: ["/dashboard/contacts"],
  },
  {
    title: "フォーム",
    icon: FormInput,
    href: "/dashboard/forms",
    matchPaths: ["/dashboard/forms"],
  },
  {
    title: "チャット",
    icon: MessagesSquare,
    href: "/dashboard/chat",
    matchPaths: ["/dashboard/chat"],
  },
  {
    title: "カレンダー",
    icon: CalendarDays,
    href: "/dashboard/calendar",
    matchPaths: ["/dashboard/calendar"],
  },
];

// ファネルセクションは現在非表示（将来使用時にコメント解除）
// const funnelMenuItems = [
//   { title: "LP", icon: FileText, href: "/dashboard/lp", matchPaths: ["/dashboard/lp"] },
//   { title: "決済", icon: CreditCard, href: "/dashboard/payment", matchPaths: ["/dashboard/payment"] },
//   { title: "サンクス", icon: Heart, href: "/dashboard/thank-you", matchPaths: ["/dashboard/thank-you"] },
//   { title: "配信", icon: Send, href: "/dashboard/delivery", matchPaths: ["/dashboard/delivery", "/dashboard/campaigns", "/dashboard/scenarios"] },
//   { title: "紹介", icon: Users, href: "/dashboard/referral", matchPaths: ["/dashboard/referral"] },
//   { title: "結果", icon: BarChart3, href: "/dashboard/results", matchPaths: ["/dashboard/results"] },
// ];

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
      "/dashboard/lists",
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
  const supabase = useMemo(() => createClient(), []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }, [supabase, router]);

  // アクティブ状態をメモ化
  const activeStates = useMemo(() => {
    const checkActive = (matchPaths: string[]) =>
      matchPaths.some(
        (path) => pathname === path || pathname.startsWith(path + "/")
      );

    return {
      channels: channelMenuItems.map((item) => checkActive(item.matchPaths)),
      crm: crmMenuItems.map((item) => checkActive(item.matchPaths)),
      contents: contentMenuItems.map((item) => checkActive(item.matchPaths)),
      settings: {
        chatWidget: pathname.startsWith("/dashboard/chat/settings"),
        line: pathname === "/dashboard/settings/line",
        dns: pathname === "/dashboard/settings/dns",
        organization: pathname.startsWith("/dashboard/settings/organization"),
        main: pathname === "/dashboard/settings",
      },
    };
  }, [pathname]);

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>チャネル</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channelMenuItems.map((item, index) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={activeStates.channels[index]}>
                    <Link href={item.href} prefetch={true}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>CRM</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {crmMenuItems.map((item, index) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={activeStates.crm[index]}>
                    <Link href={item.href} prefetch={true}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>コンテンツ</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentMenuItems.map((item, index) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={activeStates.contents[index]}>
                    <Link href={item.href} prefetch={true}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                  isActive={activeStates.settings.chatWidget}
                >
                  <Link href="/dashboard/chat/settings" prefetch={true}>
                    <MessagesSquare className="size-4" />
                    <span>チャットウィジェット</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={activeStates.settings.line}
                >
                  <Link href="/dashboard/settings/line" prefetch={true}>
                    <MessageSquare className="size-4" />
                    <span>LINE連携</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={activeStates.settings.dns}
                >
                  <Link href="/dashboard/settings/dns" prefetch={true}>
                    <Shield className="size-4" />
                    <span>DNS設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={activeStates.settings.organization}
                >
                  <Link href="/dashboard/settings/organization" prefetch={true}>
                    <Building2 className="size-4" />
                    <span>組織設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={activeStates.settings.main}
                >
                  <Link href="/dashboard/settings" prefetch={true}>
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
