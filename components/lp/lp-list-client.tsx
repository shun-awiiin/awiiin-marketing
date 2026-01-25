"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Eye, Edit, Trash2, Copy, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  view_count: number;
  form_submission_count: number;
  created_at: string;
  updated_at: string;
}

interface LPListClientProps {
  landingPages: LandingPage[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "下書き", variant: "secondary" },
  published: { label: "公開中", variant: "default" },
  archived: { label: "アーカイブ", variant: "outline" },
};

export function LPListClient({ landingPages }: LPListClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("このLPを削除しますか？")) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/landing-pages/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      toast.success("LPを削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCopyUrl = (slug: string) => {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URLをコピーしました");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Link href="/dashboard/lp/new">
            <Button>
              <Plus className="size-4 mr-2" />
              新規作成
            </Button>
          </Link>
          <Link href="/dashboard/lp/generate">
            <Button variant="outline">
              <Sparkles className="size-4 mr-2" />
              AIで生成
            </Button>
          </Link>
        </div>
      </div>

      {landingPages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">LPがありません</h3>
              <p className="text-muted-foreground">
                AIを使って最初のLPを作成しましょう
              </p>
              <Link href="/dashboard/lp/generate">
                <Button>
                  <Sparkles className="size-4 mr-2" />
                  AIでLPを生成
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>ランディングページ一覧</CardTitle>
            <CardDescription>
              {landingPages.length}件のLPがあります
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>タイトル</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">PV</TableHead>
                  <TableHead className="text-right">CV</TableHead>
                  <TableHead className="text-right">CVR</TableHead>
                  <TableHead>更新日</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {landingPages.map((lp) => {
                  const viewCount = lp.view_count ?? 0;
                  const formCount = lp.form_submission_count ?? 0;
                  const cvr = viewCount > 0
                    ? ((formCount / viewCount) * 100).toFixed(1)
                    : "0.0";
                  const status = statusLabels[lp.status] || statusLabels.draft;

                  return (
                    <TableRow key={lp.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lp.title}</div>
                          <div className="text-sm text-muted-foreground">
                            /lp/{lp.slug}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {viewCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{cvr}%</TableCell>
                      <TableCell>
                        {new Date(lp.updated_at).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/lp/${lp.slug}`} target="_blank">
                                <ExternalLink className="size-4 mr-2" />
                                プレビュー
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/lp/${lp.id}`}>
                                <Eye className="size-4 mr-2" />
                                詳細
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/lp/${lp.id}/edit`}>
                                <Edit className="size-4 mr-2" />
                                編集
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyUrl(lp.slug)}>
                              <Copy className="size-4 mr-2" />
                              URLをコピー
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(lp.id)}
                              disabled={isDeleting === lp.id}
                            >
                              <Trash2 className="size-4 mr-2" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
