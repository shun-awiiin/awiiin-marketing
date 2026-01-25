"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Eye,
  ExternalLink,
  Copy,
  Settings,
  BarChart3,
  Pencil,
  Trash2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { LPPreview } from "./lp-preview";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  blocks: unknown[];
  settings: Record<string, unknown>;
  custom_css: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface LPDetailClientProps {
  landingPage: LandingPage;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "下書き", variant: "secondary" },
  published: { label: "公開中", variant: "default" },
  archived: { label: "アーカイブ", variant: "outline" },
};

export function LPDetailClient({ landingPage }: LPDetailClientProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const status = statusLabels[landingPage.status] || statusLabels.draft;

  const handleCopyUrl = () => {
    const url = `${window.location.origin}/lp/${landingPage.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URLをコピーしました");
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/landing-pages/${landingPage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: landingPage.status === "published" ? "draft" : "published",
        }),
      });

      if (!response.ok) {
        throw new Error("更新に失敗しました");
      }

      toast.success(
        landingPage.status === "published" ? "非公開にしました" : "公開しました"
      );
      router.refresh();
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("このLPを削除しますか？この操作は取り消せません。")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/landing-pages/${landingPage.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      toast.success("LPを削除しました");
      router.push("/dashboard/lp");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/lp">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{landingPage.title}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              /lp/{landingPage.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyUrl}>
            <Copy className="size-4 mr-2" />
            URLコピー
          </Button>
          <Link href={`/lp/${landingPage.slug}`} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4 mr-2" />
              プレビュー
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing}
            variant={landingPage.status === "published" ? "outline" : "default"}
          >
            <Globe className="size-4 mr-2" />
            {landingPage.status === "published" ? "非公開にする" : "公開する"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ステータス</CardDescription>
            <CardTitle className="text-xl">
              <Badge variant={status.variant}>{status.label}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ブロック数</CardDescription>
            <CardTitle className="text-2xl">{landingPage.blocks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>作成日</CardDescription>
            <CardTitle className="text-lg">
              {new Date(landingPage.created_at).toLocaleDateString("ja-JP")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>更新日</CardDescription>
            <CardTitle className="text-lg">
              {new Date(landingPage.updated_at).toLocaleDateString("ja-JP")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">
            <Eye className="size-4 mr-2" />
            プレビュー
          </TabsTrigger>
          <TabsTrigger value="blocks">
            <Pencil className="size-4 mr-2" />
            ブロック
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="size-4 mr-2" />
            分析
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-4 mr-2" />
            設定
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <Card>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <LPPreview blocks={landingPage.blocks} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks">
          <Card>
            <CardHeader>
              <CardTitle>ブロック一覧</CardTitle>
              <CardDescription>
                {landingPage.blocks.length}個のブロックで構成されています
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(landingPage.blocks as Array<{ id: string; type: string; content: Record<string, unknown> }>).map((block, index) => (
                  <div
                    key={block.id || index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-6">
                        {index + 1}
                      </span>
                      <Badge variant="outline">{block.type}</Badge>
                      <span className="text-sm">
                        {(block.content as Record<string, string>)?.headline ||
                          (block.content as Record<string, string>)?.title ||
                          ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>分析</CardTitle>
              <CardDescription>
                LPのパフォーマンスを確認できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                分析機能は今後実装予定です。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>設定</CardTitle>
              <CardDescription>LPの設定を変更できます</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">LPを削除</h4>
                  <p className="text-sm text-muted-foreground">
                    この操作は取り消せません
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="size-4 mr-2" />
                  削除
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
