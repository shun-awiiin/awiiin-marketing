"use client";

import React from "react"

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Send,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Mail,
  Users,
  List,
  Filter,
  Tag,
} from "lucide-react";
import { TestSendDialog } from "./test-send-dialog";
import { RealtimeStats } from "./realtime-stats";
import { ClientDate } from "@/components/ui/client-date";
import { YouTubePostCard } from "./youtube-post-card";
import { WhatsAppDMCard } from "./whatsapp-dm-card";
import { XPostCard } from "./x-post-card";
import { InstagramPostCard } from "./instagram-post-card";
import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from "@/lib/types/database";
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

interface Campaign {
  id: string;
  name: string;
  status: string;
  type: TemplateType;
  input_payload: SeminarInvitePayload | FreeTrialInvitePayload;
  subject_override: string | null;
  body_override: string | null;
  filter_tags: string[] | null;
  segment_id: string | null;
  list_id: string | null;
  specific_emails: string[] | null;
  scheduled_at: string | null;
  created_at: string;
  templates: {
    name: string;
    subject: string;
    body_text: string;
  } | null;
  list_info: { name: string; contact_count: number } | null;
  segment_info: { name: string; contact_count: number } | null;
}

interface Message {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  to_email: string;
  contacts: {
    email: string;
    name: string | null;
  } | null;
}

interface Stats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  bounced: number;
}

interface CampaignDetailProps {
  campaign: Campaign;
  messages: Message[];
  stats: Stats;
}

export function CampaignDetail({ campaign, messages, stats }: CampaignDetailProps) {
  const orgFetch = useOrgFetch();
  const [currentStatus, setCurrentStatus] = useState(campaign.status);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", campaign.id);

    if (!error) {
      setCurrentStatus(newStatus);
    }
    setLoading(false);
  };

  // 送信プロセスを開始
  const handleStartSending = async () => {
    setLoading(true);
    try {
      // まずステータスをsendingに更新
      const { error: statusError } = await supabase
        .from("campaigns")
        .update({ status: "sending" })
        .eq("id", campaign.id);

      if (statusError) {
        alert(`ステータス更新エラー: ${statusError.message}`);
        setLoading(false);
        return;
      }

      setCurrentStatus("sending");

      // 送信プロセスを呼び出し（同期的に待つ）
      const response = await orgFetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`送信エラー: ${errorData.error || "送信に失敗しました"}`);
      } else {
        const result = await response.json();
        alert(`送信完了: ${result.sent}件送信、${result.failed}件失敗`);
        router.refresh();
      }
    } catch (error) {
      console.error("Send error:", error);
      alert("送信処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; className: string; icon: React.ElementType }
    > = {
      draft: {
        label: "下書き",
        className: "bg-muted text-muted-foreground",
        icon: Clock,
      },
      scheduled: {
        label: "予約済み",
        className: "bg-blue-100 text-blue-700",
        icon: Clock,
      },
      queued: {
        label: "キュー待ち",
        className: "bg-purple-100 text-purple-700",
        icon: Clock,
      },
      sending: {
        label: "送信中",
        className: "bg-yellow-100 text-yellow-700",
        icon: Send,
      },
      completed: {
        label: "完了",
        className: "bg-green-100 text-green-700",
        icon: CheckCircle,
      },
      paused: {
        label: "一時停止",
        className: "bg-orange-100 text-orange-700",
        icon: Pause,
      },
      stopped: {
        label: "停止",
        className: "bg-red-100 text-red-700",
        icon: XCircle,
      },
    };
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${config.className}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "bounced":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            {getStatusBadge(currentStatus)}
          </div>
          <p className="text-muted-foreground">
            作成日: <ClientDate date={campaign.created_at} />
          </p>
        </div>
        <div className="flex gap-2">
          {["draft", "scheduled", "paused", "queued"].includes(currentStatus) && (
            <TestSendDialog
              campaignId={campaign.id}
              campaignName={campaign.name}
              disabled={loading}
            />
          )}
          {["draft", "queued"].includes(currentStatus) && (
            <Button onClick={handleStartSending} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "送信中..." : "送信開始"}
            </Button>
          )}
          {currentStatus === "sending" && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange("paused")}
              disabled={loading}
            >
              <Pause className="mr-2 h-4 w-4" />
              一時停止
            </Button>
          )}
          {currentStatus === "paused" && (
            <Button onClick={() => handleStatusChange("sending")} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              再開
            </Button>
          )}
        </div>
      </div>

      {/* Recipient Source */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">宛先情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {campaign.list_id && campaign.list_info ? (
              <>
                <List className="h-4 w-4 text-muted-foreground" />
                <span>リスト: {campaign.list_info.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({campaign.list_info.contact_count}件)
                </span>
              </>
            ) : campaign.segment_id && campaign.segment_info ? (
              <>
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>セグメント: {campaign.segment_info.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({campaign.segment_info.contact_count}件)
                </span>
              </>
            ) : campaign.filter_tags && campaign.filter_tags.length > 0 ? (
              <>
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span>タグフィルター ({campaign.filter_tags.length}件のタグ)</span>
              </>
            ) : campaign.specific_emails && campaign.specific_emails.length > 0 ? (
              <>
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>指定メールアドレス ({campaign.specific_emails.length}件)</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>全ての有効な連絡先</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Statistics */}
      <RealtimeStats
        campaignId={campaign.id}
        campaignStatus={currentStatus}
      />

      <Tabs defaultValue="messages">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="messages">送信履歴</TabsTrigger>
          <TabsTrigger value="content">メール内容</TabsTrigger>
          <TabsTrigger value="x">X</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ステータス</TableHead>
                    <TableHead>宛先</TableHead>
                    <TableHead>名前</TableHead>
                    <TableHead>送信日時</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Mail className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            まだ送信履歴がありません
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    messages.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMessageStatusIcon(message.status)}
                            <span className="text-sm capitalize">
                              {message.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{message.contacts?.email || message.to_email}</TableCell>
                        <TableCell>{message.contacts?.name || "-"}</TableCell>
                        <TableCell>
                          {message.sent_at ? (
                            <ClientDate date={message.sent_at} format="datetime" />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">メール内容</CardTitle>
              <CardDescription>
                テンプレート: {campaign.templates?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">件名</p>
                  <p className="font-medium">
                    {campaign.subject_override || campaign.templates?.subject}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">本文</p>
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {campaign.body_override || campaign.templates?.body_text}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="x" className="mt-4">
          <XPostCard
            campaignId={campaign.id}
            campaignType={campaign.type}
            inputPayload={campaign.input_payload}
          />
        </TabsContent>

        <TabsContent value="instagram" className="mt-4">
          <InstagramPostCard
            campaignId={campaign.id}
            campaignType={campaign.type}
            inputPayload={campaign.input_payload}
          />
        </TabsContent>

        <TabsContent value="youtube" className="mt-4">
          <YouTubePostCard
            campaignId={campaign.id}
            campaignType={campaign.type}
            inputPayload={campaign.input_payload}
          />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppDMCard
            campaignId={campaign.id}
            campaignType={campaign.type}
            inputPayload={campaign.input_payload}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
