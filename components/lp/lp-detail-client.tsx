"use client";

import { useState, useCallback } from "react";
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
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { LPPreview } from "./lp-preview";

interface LPSection {
  id: string;
  type: string;
  html: string;
  order: number;
}

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
  const [isSaving, setIsSaving] = useState(false);
  const [localBlocks, setLocalBlocks] = useState(landingPage.blocks);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const status = statusLabels[landingPage.status] || statusLabels.draft;

  // セクション編集（AI）
  const handleSectionEdit = useCallback(async (section: LPSection, instruction: string) => {
    toast.info("AIで編集中...");
    try {
      const response = await fetch("/api/landing-pages/generate-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          instruction,
          input: { product_name: landingPage.title, target_audience: "", main_problem: "", solution: "" },
        }),
      });

      if (!response.ok) throw new Error("編集に失敗しました");
      
      const data = await response.json();
      const updatedSection = data.data.section;
      
      // ローカルステートを更新
      setLocalBlocks((prev) => {
        const blocks = [...prev] as Array<{ id: string; type: string; content: Record<string, unknown> }>;
        const htmlBlock = blocks.find((b) => b.type === "html");
        if (htmlBlock) {
          const content = htmlBlock.content as { sections?: LPSection[] };
          if (content.sections) {
            content.sections = content.sections.map((s) => 
              s.id === section.id ? updatedSection : s
            );
          }
        }
        return blocks;
      });
      setHasUnsavedChanges(true);
      toast.success("セクションを編集しました");
    } catch {
      toast.error("編集に失敗しました");
    }
  }, [landingPage.title]);

  // セクション再生成
  const handleSectionRegenerate = useCallback(async (sectionType: string) => {
    toast.info("AIで再生成中...");
    try {
      const response = await fetch("/api/landing-pages/generate-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType,
          input: { product_name: landingPage.title, target_audience: "", main_problem: "", solution: "" },
        }),
      });

      if (!response.ok) throw new Error("再生成に失敗しました");
      
      const data = await response.json();
      const newSection = data.data.section;
      
      // 該当タイプのセクションを置き換え
      setLocalBlocks((prev) => {
        const blocks = [...prev] as Array<{ id: string; type: string; content: Record<string, unknown> }>;
        const htmlBlock = blocks.find((b) => b.type === "html");
        if (htmlBlock) {
          const content = htmlBlock.content as { sections?: LPSection[] };
          if (content.sections) {
            const index = content.sections.findIndex((s) => s.type === sectionType);
            if (index !== -1) {
              newSection.order = content.sections[index].order;
              content.sections[index] = newSection;
            }
          }
        }
        return blocks;
      });
      setHasUnsavedChanges(true);
      toast.success("セクションを再生成しました");
    } catch {
      toast.error("再生成に失敗しました");
    }
  }, [landingPage.title]);

  // セクション並べ替え
  const handleSectionsReorder = useCallback((sections: LPSection[]) => {
    setLocalBlocks((prev) => {
      const blocks = [...prev] as Array<{ id: string; type: string; content: Record<string, unknown> }>;
      const htmlBlock = blocks.find((b) => b.type === "html");
      if (htmlBlock) {
        (htmlBlock.content as { sections?: LPSection[] }).sections = sections;
      }
      return blocks;
    });
    setHasUnsavedChanges(true);
  }, []);

  // セクション削除
  const handleSectionDelete = useCallback((sectionId: string) => {
    if (!confirm("このセクションを削除しますか？")) return;
    
    setLocalBlocks((prev) => {
      const blocks = [...prev] as Array<{ id: string; type: string; content: Record<string, unknown> }>;
      const htmlBlock = blocks.find((b) => b.type === "html");
      if (htmlBlock) {
        const content = htmlBlock.content as { sections?: LPSection[] };
        if (content.sections) {
          content.sections = content.sections.filter((s) => s.id !== sectionId);
          content.sections.forEach((s, i) => s.order = i);
        }
      }
      return blocks;
    });
    setHasUnsavedChanges(true);
    toast.success("セクションを削除しました");
  }, []);

  // セクションHTML直接更新
  const handleSectionHTMLUpdate = useCallback((updatedSection: LPSection) => {
    setLocalBlocks((prev) => {
      const blocks = [...prev] as Array<{ id: string; type: string; content: Record<string, unknown> }>;
      const htmlBlock = blocks.find((b) => b.type === "html");
      if (htmlBlock) {
        const content = htmlBlock.content as { sections?: LPSection[] };
        if (content.sections) {
          content.sections = content.sections.map((s) => 
            s.id === updatedSection.id ? updatedSection : s
          );
        }
      }
      return blocks;
    });
    setHasUnsavedChanges(true);
    toast.success("HTMLを保存しました");
  }, []);

  // セクション追加
  const handleSectionAdd = useCallback(async (sectionType: string, position: number) => {
    toast.info("セクションを生成中...");
    try {
      const response = await fetch("/api/landing-pages/generate-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType,
          input: { product_name: landingPage.title, target_audience: "", main_problem: "", solution: "" },
        }),
      });

      if (!response.ok) throw new Error("生成に失敗しました");
      
      const data = await response.json();
      const newSection = { ...data.data.section, order: position };
      
      setLocalBlocks((prev) => {
        const blocks = [...prev] as Array<{ id: string; type: string; content: Record<string, unknown> }>;
        const htmlBlock = blocks.find((b) => b.type === "html");
        if (htmlBlock) {
          const content = htmlBlock.content as { sections?: LPSection[] };
          if (content.sections) {
            content.sections.splice(position, 0, newSection);
            content.sections.forEach((s, i) => s.order = i);
          } else {
            (htmlBlock.content as { sections: LPSection[] }).sections = [newSection];
          }
        }
        return blocks;
      });
      setHasUnsavedChanges(true);
      toast.success("セクションを追加しました");
    } catch {
      toast.error("セクション追加に失敗しました");
    }
  }, [landingPage.title]);

  // 変更を保存
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/landing-pages/${landingPage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: localBlocks }),
      });

      if (!response.ok) throw new Error("保存に失敗しました");

      setHasUnsavedChanges(false);
      toast.success("変更を保存しました");
      router.refresh();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

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
          {hasUnsavedChanges && (
            <Button 
              size="sm" 
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              変更を保存
            </Button>
          )}
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
            <CardContent className="p-4">
              <LPPreview blocks={localBlocks} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks">
          <Card>
            <CardHeader>
              <CardTitle>セクション編集</CardTitle>
              <CardDescription>
                各セクションを編集・並べ替え・追加・削除できます
                {hasUnsavedChanges && (
                  <span className="text-orange-500 ml-2">（未保存の変更があります）</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LPPreview 
                blocks={localBlocks} 
                editable={true}
                onSectionEdit={handleSectionEdit}
                onSectionRegenerate={handleSectionRegenerate}
                onSectionsReorder={handleSectionsReorder}
                onSectionDelete={handleSectionDelete}
                onSectionHTMLUpdate={handleSectionHTMLUpdate}
                onSectionAdd={handleSectionAdd}
              />
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
