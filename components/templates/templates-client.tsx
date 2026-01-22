"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Eye,
  Copy,
  Trash2,
  MoreHorizontal,
  Lock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplatePreview } from "./template-preview";

interface Template {
  id: string;
  name: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  category: string;
  is_preset: boolean;
  user_id: string | null;
}

interface TemplatesClientProps {
  templates: Template[];
  userId: string;
}

export function TemplatesClient({ templates: initialTemplates, userId }: TemplatesClientProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    body_text: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const presetTemplates = templates.filter((t) => t.is_preset);
  const customTemplates = templates.filter((t) => !t.is_preset);

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body_text) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("templates")
      .insert({
        user_id: userId,
        name: newTemplate.name,
        subject: newTemplate.subject,
        body_text: newTemplate.body_text,
        category: "custom",
        is_preset: false,
      })
      .select()
      .single();

    if (!error && data) {
      setTemplates([...templates, data]);
      setNewTemplate({ name: "", subject: "", body_text: "" });
      setIsCreateDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDuplicate = async (template: Template) => {
    const { data, error } = await supabase
      .from("templates")
      .insert({
        user_id: userId,
        name: `${template.name} (コピー)`,
        subject: template.subject,
        body_text: template.body_text,
        body_html: template.body_html,
        category: "custom",
        is_preset: false,
      })
      .select()
      .single();

    if (!error && data) {
      setTemplates([...templates, data]);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (!error) {
      setTemplates(templates.filter((t) => t.id !== id));
    }
  };

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      seminar: "セミナー案内",
      registration: "登録案内",
      reminder: "リマインダー",
      custom: "カスタム",
    };
    return labels[category] || category;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">テンプレート</h1>
          <p className="text-muted-foreground">
            到達率最適化済みのテンプレートを使用してメールを作成
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              テンプレート作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>テンプレートを作成</DialogTitle>
              <DialogDescription>
                新しいメールテンプレートを作成します。プレースホルダーを使用できます。
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">テンプレート名</Label>
                <Input
                  id="name"
                  placeholder="例: 月次セミナー案内"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subject">件名</Label>
                <Input
                  id="subject"
                  placeholder="例: 【ご案内】{event_name}のお知らせ"
                  value={newTemplate.subject}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, subject: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="body">本文</Label>
                <Textarea
                  id="body"
                  placeholder="メール本文を入力..."
                  rows={10}
                  value={newTemplate.body_text}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, body_text: e.target.value })
                  }
                />
              </div>
              <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                <p className="font-medium mb-1">使用可能なプレースホルダー:</p>
                <p>{"{name}"} - 受信者名, {"{company}"} - 会社名, {"{event_name}"} - イベント名</p>
                <p>{"{event_date}"} - 日時, {"{event_location}"} - 場所, {"{registration_url}"} - 登録URL</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreateTemplate} disabled={loading}>
                {loading ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {presetTemplates.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            プリセットテンプレート
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {presetTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={handlePreview}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                getCategoryLabel={getCategoryLabel}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">カスタムテンプレート</h2>
        {customTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                カスタムテンプレートがありません
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                テンプレートを作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={handlePreview}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                getCategoryLabel={getCategoryLabel}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        {selectedTemplate && (
          <TemplatePreview
            template={selectedTemplate}
            onClose={() => setIsPreviewDialogOpen(false)}
          />
        )}
      </Dialog>
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onPreview: (template: Template) => void;
  onDuplicate: (template: Template) => void;
  onDelete: (id: string) => void;
  getCategoryLabel: (category: string) => string;
}

function TemplateCard({
  template,
  onPreview,
  onDuplicate,
  onDelete,
  getCategoryLabel,
}: TemplateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{template.name}</CardTitle>
            <Badge variant="secondary" className="w-fit text-xs">
              {getCategoryLabel(template.category)}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(template)}>
                <Eye className="mr-2 h-4 w-4" />
                プレビュー
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template)}>
                <Copy className="mr-2 h-4 w-4" />
                複製
              </DropdownMenuItem>
              {!template.is_preset && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(template.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    削除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          件名: {template.subject}
        </p>
      </CardContent>
    </Card>
  );
}
