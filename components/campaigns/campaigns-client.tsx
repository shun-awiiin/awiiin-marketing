"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, MoreHorizontal, Eye, Trash2, Send, Pause, Play } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  templates: { name: string } | null;
}

interface CampaignsClientProps {
  campaigns: Campaign[];
}

// 削除不可のステータス
const ACTIVE_STATUSES = ["sending", "queued", "scheduled", "paused"];

export function CampaignsClient({ campaigns: initialCampaigns }: CampaignsClientProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const supabase = createClient();

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 選択中のキャンペーンでアクティブ状態のもの
  const selectedActiveCampaigns = filteredCampaigns.filter(
    (c) => selectedCampaigns.includes(c.id) && ACTIVE_STATUSES.includes(c.status)
  );

  // 選択中で削除可能なキャンペーン数
  const deletableCount = selectedCampaigns.length - selectedActiveCampaigns.length;

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (!error) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
      setSelectedCampaigns(selectedCampaigns.filter((sid) => sid !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCampaigns.length === 0) return;
    setBulkDeleteLoading(true);

    try {
      const response = await fetch("/api/campaigns/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedCampaigns }),
      });

      const result = await response.json();

      if (response.ok && result.data) {
        const deletedIds = result.data.deleted.map((c: { id: string }) => c.id);
        setCampaigns(campaigns.filter((c) => !deletedIds.includes(c.id)));
        setSelectedCampaigns([]);
      }
    } finally {
      setBulkDeleteLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error) {
      setCampaigns(
        campaigns.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    }
  };

  const toggleSelectAll = () => {
    const pageIds = filteredCampaigns.map((c) => c.id);
    const allSelectedOnPage = pageIds.every((id) => selectedCampaigns.includes(id));

    if (allSelectedOnPage) {
      setSelectedCampaigns(selectedCampaigns.filter((id) => !pageIds.includes(id)));
    } else {
      const next = new Set([...selectedCampaigns, ...pageIds]);
      setSelectedCampaigns(Array.from(next));
    }
  };

  const toggleSelectCampaign = (id: string) => {
    if (selectedCampaigns.includes(id)) {
      setSelectedCampaigns(selectedCampaigns.filter((sid) => sid !== id));
    } else {
      setSelectedCampaigns([...selectedCampaigns, id]);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: "下書き", className: "bg-muted text-muted-foreground" },
      scheduled: { label: "予約済み", className: "bg-blue-100 text-blue-700" },
      queued: { label: "キュー待ち", className: "bg-purple-100 text-purple-700" },
      sending: { label: "送信中", className: "bg-yellow-100 text-yellow-700" },
      completed: { label: "完了", className: "bg-green-100 text-green-700" },
      paused: { label: "一時停止", className: "bg-orange-100 text-orange-700" },
      stopped: { label: "停止", className: "bg-red-100 text-red-700" },
      failed: { label: "失敗", className: "bg-red-100 text-red-700" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const isActiveStatus = (status: string) => ACTIVE_STATUSES.includes(status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">キャンペーン</h1>
          <p className="text-muted-foreground">
            メール配信キャンペーンを管理
          </p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新規キャンペーン
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="キャンペーン名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedCampaigns.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedCampaigns.length}件選択中
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              一括削除
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredCampaigns.length > 0 &&
                    filteredCampaigns.every((c) => selectedCampaigns.includes(c.id))
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>キャンペーン名</TableHead>
              <TableHead>テンプレート</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>予定日時</TableHead>
              <TableHead>作成日</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Send className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">キャンペーンがありません</p>
                    <Link href="/dashboard/campaigns/new">
                      <Button variant="outline" size="sm">
                        新規作成
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCampaigns.includes(campaign.id)}
                      onCheckedChange={() => toggleSelectCampaign(campaign.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{campaign.templates?.name || "-"}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>
                    {campaign.scheduled_at
                      ? new Date(campaign.scheduled_at).toLocaleString("ja-JP")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(campaign.created_at).toLocaleDateString("ja-JP")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/campaigns/${campaign.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            詳細
                          </Link>
                        </DropdownMenuItem>
                        {campaign.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(campaign.id, "scheduled")}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            送信開始
                          </DropdownMenuItem>
                        )}
                        {campaign.status === "sending" && (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(campaign.id, "paused")}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            一時停止
                          </DropdownMenuItem>
                        )}
                        {campaign.status === "paused" && (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(campaign.id, "sending")}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            再開
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(campaign.id)}
                          disabled={isActiveStatus(campaign.status)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          削除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>キャンペーンを削除</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedActiveCampaigns.length > 0 ? (
                <>
                  選択中の{selectedCampaigns.length}件のうち、
                  <span className="font-semibold text-destructive">
                    {selectedActiveCampaigns.length}件はアクティブ状態のため削除できません
                  </span>
                  （送信中、キュー待ち、予約済み、一時停止）。
                  <br />
                  残り{deletableCount}件を削除しますか？
                </>
              ) : (
                <>
                  選択中の{selectedCampaigns.length}件のキャンペーンを削除しますか？
                  この操作は取り消せません。関連するメール送信履歴も削除されます。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteLoading || deletableCount === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteLoading ? "削除中..." : `${deletableCount}件を削除`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
