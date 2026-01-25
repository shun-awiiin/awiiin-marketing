"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Pencil, RotateCcw, GripVertical, ChevronUp, ChevronDown, Trash2, 
  Plus, Code, Wand2, Save, X, Eye, EyeOff, ImagePlus, Type, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LPSection {
  id: string;
  type: string;
  html: string;
  order: number;
}

interface LPBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
  settings?: {
    padding?: "small" | "medium" | "large";
    width?: "narrow" | "medium" | "full";
    background_color?: string;
    text_color?: string;
  };
}

interface LPPreviewProps {
  blocks: unknown[];
  editable?: boolean;
  onSectionEdit?: (section: LPSection, instruction: string) => void;
  onSectionRegenerate?: (sectionType: string) => void;
  onSectionsReorder?: (sections: LPSection[]) => void;
  onSectionDelete?: (sectionId: string) => void;
  onSectionHTMLUpdate?: (section: LPSection) => void;
  onSectionAdd?: (sectionType: string, position: number) => void;
}

const availableSectionTypes = [
  { type: "hero", label: "ヒーロー" },
  { type: "problem", label: "問題提起" },
  { type: "empathy", label: "共感" },
  { type: "solution", label: "解決策" },
  { type: "features", label: "特徴" },
  { type: "testimonials", label: "お客様の声" },
  { type: "faq", label: "FAQ" },
  { type: "cta", label: "CTA" },
];

const paddingClasses = {
  small: "py-8",
  medium: "py-12",
  large: "py-16",
};

const widthClasses = {
  narrow: "max-w-2xl",
  medium: "max-w-4xl",
  full: "max-w-full",
};

const sectionTypeLabels: Record<string, string> = {
  hero: "ヒーロー",
  problem: "問題提起",
  empathy: "共感",
  solution: "解決策",
  features: "特徴",
  testimonials: "お客様の声",
  faq: "FAQ",
  cta: "CTA",
};

export function LPPreview({ 
  blocks, 
  editable = false,
  onSectionEdit,
  onSectionRegenerate,
  onSectionsReorder,
  onSectionDelete,
  onSectionHTMLUpdate,
  onSectionAdd,
}: LPPreviewProps) {
  const typedBlocks = blocks as LPBlock[];

  if (!typedBlocks.length) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        ブロックがありません
      </div>
    );
  }

  // HTMLブロックがある場合はHTMLプレビューを表示
  const htmlBlock = typedBlocks.find((b) => b.type === "html");
  if (htmlBlock) {
    return (
      <SectionBasedPreview 
        block={htmlBlock} 
        editable={editable}
        onSectionEdit={onSectionEdit}
        onSectionRegenerate={onSectionRegenerate}
        onSectionsReorder={onSectionsReorder}
        onSectionDelete={onSectionDelete}
        onSectionHTMLUpdate={onSectionHTMLUpdate}
        onSectionAdd={onSectionAdd}
      />
    );
  }

  return (
    <div className="bg-white">
      {typedBlocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}

// セクションベースのプレビュー（編集可能）
function SectionBasedPreview({ 
  block, 
  editable,
  onSectionEdit,
  onSectionRegenerate,
  onSectionsReorder,
  onSectionDelete,
  onSectionHTMLUpdate,
  onSectionAdd,
}: { 
  block: LPBlock;
  editable?: boolean;
  onSectionEdit?: (section: LPSection, instruction: string) => void;
  onSectionRegenerate?: (sectionType: string) => void;
  onSectionsReorder?: (sections: LPSection[]) => void;
  onSectionDelete?: (sectionId: string) => void;
  onSectionHTMLUpdate?: (section: LPSection) => void;
  onSectionAdd?: (sectionType: string, position: number) => void;
}) {
  const content = block.content as { 
    sections?: LPSection[]; 
    globalCss?: string;
    // 旧形式対応
    html?: string;
    css?: string;
  };

  // 旧形式（html/css直接）の場合
  if (content.html && !content.sections) {
    return <LegacyHTMLPreview html={content.html} css={content.css || ""} />;
  }

  const [sections, setSections] = useState<LPSection[]>(content.sections || []);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"ai" | "html" | "visual">("ai");
  const [editInstruction, setEditInstruction] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [showAddSection, setShowAddSection] = useState<number | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  useEffect(() => {
    setSections(content.sections || []);
  }, [content.sections]);

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSections.length) return;
    
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    newSections.forEach((s, i) => s.order = i);
    setSections(newSections);
    onSectionsReorder?.(newSections);
  };

  const handleEditSubmit = (section: LPSection) => {
    if (editInstruction.trim()) {
      onSectionEdit?.(section, editInstruction);
      setEditingSection(null);
      setEditInstruction("");
    }
  };

  const handleHTMLSave = (section: LPSection) => {
    const updatedSection = { ...section, html: editHtml };
    onSectionHTMLUpdate?.(updatedSection);
    
    // ローカルステートも更新
    setSections(prev => prev.map(s => s.id === section.id ? updatedSection : s));
    setEditingSection(null);
    setEditHtml("");
  };

  const handleStartEdit = (section: LPSection) => {
    if (editingSection === section.id) {
      setEditingSection(null);
      setEditHtml("");
      setEditInstruction("");
    } else {
      setEditingSection(section.id);
      setEditHtml(section.html);
      setEditInstruction("");
      setEditMode("ai");
    }
  };

  const handleAddSection = (sectionType: string, position: number) => {
    onSectionAdd?.(sectionType, position);
    setShowAddSection(null);
  };

  if (!sections.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-96 text-muted-foreground border rounded-lg bg-muted/50">
          セクションがありません
        </div>
        {editable && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowAddSection(0)}
          >
            <Plus className="size-4 mr-2" />
            セクションを追加
          </Button>
        )}
        {showAddSection === 0 && (
          <AddSectionMenu 
            onSelect={(type) => handleAddSection(type, 0)}
            onCancel={() => setShowAddSection(null)}
          />
        )}
      </div>
    );
  }

  // 全セクションを結合してiframeで表示
  const fullHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${content.globalCss || ""}</style>
</head>
<body style="margin:0;padding:0;">
  ${sections.sort((a, b) => a.order - b.order).map(s => s.html).join("\n")}
</body>
</html>
`;

  return (
    <div className="space-y-4">
      {/* プレビュー */}
      <div className="border rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b cursor-pointer"
          onClick={() => setPreviewCollapsed(!previewCollapsed)}
        >
          <span className="text-sm font-medium">プレビュー</span>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {previewCollapsed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
        </div>
        {!previewCollapsed && (
          <div className="bg-white">
            <IframePreview html={fullHtml} />
          </div>
        )}
      </div>

      {/* 編集モード時のセクションリスト */}
      {editable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground">セクション編集</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddSection(sections.length)}
            >
              <Plus className="size-4 mr-1" />
              追加
            </Button>
          </div>

          {sections.sort((a, b) => a.order - b.order).map((section, index) => (
            <div key={section.id}>
              {/* セクション追加ボタン（各セクションの上） */}
              {showAddSection === index && (
                <AddSectionMenu 
                  onSelect={(type) => handleAddSection(type, index)}
                  onCancel={() => setShowAddSection(null)}
                />
              )}

              <div className="border rounded-lg bg-card overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                    <span className="font-medium text-sm">
                      {sectionTypeLabels[section.type] || section.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveSection(index, "up")}
                      disabled={index === 0}
                      title="上に移動"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveSection(index, "down")}
                      disabled={index === sections.length - 1}
                      title="下に移動"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleStartEdit(section)}
                      title="編集"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onSectionRegenerate?.(section.type)}
                      title="AI再生成"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowAddSection(index)}
                      title="この上に追加"
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onSectionDelete?.(section.id)}
                      title="削除"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* 編集エリア */}
                {editingSection === section.id && (
                  <SectionEditor
                    section={section}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    editInstruction={editInstruction}
                    setEditInstruction={setEditInstruction}
                    editHtml={editHtml}
                    setEditHtml={setEditHtml}
                    onAIEdit={() => handleEditSubmit(section)}
                    onHTMLSave={() => handleHTMLSave(section)}
                    onCancel={() => handleStartEdit(section)}
                    onHTMLUpdate={(html) => {
                      setEditHtml(html);
                    }}
                    globalCss={content.globalCss || ""}
                  />
                )}
              </div>
            </div>
          ))}

          {/* 最後にセクション追加 */}
          {showAddSection === sections.length && (
            <AddSectionMenu 
              onSelect={(type) => handleAddSection(type, sections.length)}
              onCancel={() => setShowAddSection(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// セクション追加メニュー
function AddSectionMenu({ 
  onSelect, 
  onCancel 
}: { 
  onSelect: (type: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="border rounded-lg p-3 bg-card mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">セクションを追加</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {availableSectionTypes.map((st) => (
          <Button
            key={st.type}
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onSelect(st.type)}
          >
            {st.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// セクション編集コンポーネント（AI編集、HTML編集、ビジュアル編集）
function SectionEditor({
  section,
  editMode,
  setEditMode,
  editInstruction,
  setEditInstruction,
  editHtml,
  setEditHtml,
  onAIEdit,
  onHTMLSave,
  onCancel,
  onHTMLUpdate,
  globalCss,
}: {
  section: LPSection;
  editMode: "ai" | "html" | "visual";
  setEditMode: (mode: "ai" | "html" | "visual") => void;
  editInstruction: string;
  setEditInstruction: (value: string) => void;
  editHtml: string;
  setEditHtml: (value: string) => void;
  onAIEdit: () => void;
  onHTMLSave: () => void;
  onCancel: () => void;
  onHTMLUpdate: (html: string) => void;
  globalCss: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visualIframeRef = useRef<HTMLIFrameElement>(null);

  // 画像アップロード
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("画像サイズは5MB以下にしてください");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileName = `lp-images/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      
      const { data, error } = await supabase.storage
        .from("lp-assets")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("lp-assets")
        .getPublicUrl(data.path);

      setUploadedImageUrl(urlData.publicUrl);
      
      // HTMLに画像タグを挿入
      const imgTag = `<img src="${urlData.publicUrl}" alt="画像" style="max-width: 100%; height: auto;" />`;
      setEditHtml(editHtml + "\n" + imgTag);
      
    } catch (error) {
      console.error("Upload error:", error);
      alert("画像のアップロードに失敗しました");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ビジュアル編集用のiframeからHTMLを取得
  const getVisualEditedHtml = () => {
    if (visualIframeRef.current) {
      const doc = visualIframeRef.current.contentDocument;
      if (doc && doc.body) {
        // body内のセクションを取得
        const sectionEl = doc.body.querySelector("section");
        if (sectionEl) {
          return sectionEl.outerHTML;
        }
        return doc.body.innerHTML;
      }
    }
    return editHtml;
  };

  // ビジュアル編集を保存
  const handleVisualSave = () => {
    const newHtml = getVisualEditedHtml();
    onHTMLUpdate(newHtml);
    onHTMLSave();
  };

  return (
    <div className="p-3 space-y-3 bg-muted/10">
      <Tabs value={editMode} onValueChange={(v) => setEditMode(v as "ai" | "html" | "visual")}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai" className="text-xs">
            <Wand2 className="size-3 mr-1" />
            AI編集
          </TabsTrigger>
          <TabsTrigger value="visual" className="text-xs">
            <Type className="size-3 mr-1" />
            直接編集
          </TabsTrigger>
          <TabsTrigger value="html" className="text-xs">
            <Code className="size-3 mr-1" />
            HTML
          </TabsTrigger>
        </TabsList>

        {/* AI編集 */}
        <TabsContent value="ai" className="space-y-2 mt-3">
          <textarea
            className="w-full p-2 border rounded text-sm font-sans"
            rows={3}
            placeholder="編集指示を入力&#10;例：見出しをもっとインパクトのあるものに変更&#10;例：背景色を青に変更&#10;例：ボタンのテキストを「今すぐ申し込む」に"
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
          />
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={onAIEdit}
              disabled={!editInstruction.trim()}
            >
              <Wand2 className="size-3 mr-1" />
              AIで編集
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onCancel}
            >
              キャンセル
            </Button>
          </div>
        </TabsContent>

        {/* ビジュアル編集（直接編集） */}
        <TabsContent value="visual" className="space-y-3 mt-3">
          <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
            下のプレビュー内のテキストを直接クリックして編集できます
          </div>
          <div className="border rounded overflow-hidden bg-white">
            <VisualEditor
              ref={visualIframeRef}
              html={editHtml}
              css={globalCss}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleVisualSave}
            >
              <Save className="size-3 mr-1" />
              保存
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onCancel}
            >
              キャンセル
            </Button>
          </div>
        </TabsContent>

        {/* HTML編集 */}
        <TabsContent value="html" className="space-y-3 mt-3">
          {/* 画像アップロード */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <ImagePlus className="size-3 mr-1" />
              )}
              画像を追加
            </Button>
            {uploadedImageUrl && (
              <span className="text-xs text-green-600">画像をHTMLに挿入しました</span>
            )}
          </div>

          {/* HTMLエディター */}
          <textarea
            className="w-full p-2 border rounded text-xs font-mono bg-slate-900 text-slate-100"
            rows={15}
            value={editHtml}
            onChange={(e) => setEditHtml(e.target.value)}
            spellCheck={false}
          />
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={onHTMLSave}
            >
              <Save className="size-3 mr-1" />
              保存
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onCancel}
            >
              キャンセル
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ビジュアル編集用iframe（contentEditable）
const VisualEditor = forwardRef<
  HTMLIFrameElement,
  { html: string; css: string }
>(function VisualEditor({ html, css }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // refを結合
  useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        const fullHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${css}
    /* 編集可能要素のハイライト */
    [contenteditable="true"]:hover {
      outline: 2px dashed #3b82f6;
      outline-offset: 2px;
    }
    [contenteditable="true"]:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
  </style>
</head>
<body style="margin:0;padding:0;">
  ${html}
  <script>
    // テキスト要素を編集可能にする
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, a, button').forEach(el => {
      el.contentEditable = 'true';
    });
  </script>
</body>
</html>
`;
        doc.open();
        doc.write(fullHtml);
        doc.close();

        // 高さ調整
        const adjustHeight = () => {
          if (iframeRef.current && doc.body) {
            const height = doc.body.scrollHeight;
            iframeRef.current.style.height = `${Math.max(height, 300)}px`;
          }
        };
        setTimeout(adjustHeight, 100);
      }
    }
  }, [html, css]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full min-h-[300px] border-0"
      title="Visual Editor"
      sandbox="allow-same-origin allow-scripts"
    />
  );
});

// 旧形式HTML用プレビュー
function LegacyHTMLPreview({ html, css }: { html: string; css: string }) {
  let fullHtml = html;
  if (css) {
    const styleTag = `<style>${css}</style>`;
    if (fullHtml.includes("</head>")) {
      fullHtml = fullHtml.replace("</head>", `${styleTag}</head>`);
    } else {
      fullHtml = `${styleTag}${fullHtml}`;
    }
  }
  return <IframePreview html={fullHtml} />;
}

// iframeプレビュー共通コンポーネント
function IframePreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        const adjustHeight = () => {
          if (iframeRef.current && doc.body) {
            const height = doc.body.scrollHeight;
            iframeRef.current.style.height = `${Math.max(height, 600)}px`;
          }
        };

        setTimeout(adjustHeight, 100);
        setTimeout(adjustHeight, 500);
      }
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full min-h-[600px] border-0"
      title="LP Preview"
      sandbox="allow-same-origin allow-scripts"
    />
  );
}

function BlockRenderer({ block }: { block: LPBlock }) {
  const padding = paddingClasses[block.settings?.padding || "medium"];
  const width = widthClasses[block.settings?.width || "medium"];

  const style: React.CSSProperties = {
    backgroundColor: block.settings?.background_color,
    color: block.settings?.text_color,
  };

  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} padding={padding} width={width} style={style} />;
    case "problem":
      return <ProblemBlock block={block} padding={padding} width={width} style={style} />;
    case "solution":
      return <SolutionBlock block={block} padding={padding} width={width} style={style} />;
    case "features":
      return <FeaturesBlock block={block} padding={padding} width={width} style={style} />;
    case "testimonials":
      return <TestimonialsBlock block={block} padding={padding} width={width} style={style} />;
    case "pricing":
      return <PricingBlock block={block} padding={padding} width={width} style={style} />;
    case "bonus":
      return <BonusBlock block={block} padding={padding} width={width} style={style} />;
    case "faq":
      return <FaqBlock block={block} padding={padding} width={width} style={style} />;
    case "cta":
      return <CtaBlock block={block} padding={padding} width={width} style={style} />;
    case "form":
      return <FormBlock block={block} padding={padding} width={width} style={style} />;
    default:
      return (
        <div className={cn(padding, "px-4")} style={style}>
          <div className={cn(width, "mx-auto")}>
            <p className="text-muted-foreground">Unknown block type: {block.type}</p>
          </div>
        </div>
      );
  }
}

interface BlockProps {
  block: LPBlock;
  padding: string;
  width: string;
  style: React.CSSProperties;
}

function HeroBlock({ block, padding, style }: BlockProps) {
  const content = block.content as {
    headline?: string;
    subheadline?: string;
    cta_text?: string;
    cta_url?: string;
  };

  return (
    <div className={cn(padding, "px-4 bg-gradient-to-br from-primary/10 to-primary/5")} style={style}>
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{content.headline}</h1>
        {content.subheadline && (
          <p className="text-xl text-muted-foreground mb-8">{content.subheadline}</p>
        )}
        {content.cta_text && (
          <button className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
            {content.cta_text}
          </button>
        )}
      </div>
    </div>
  );
}

function ProblemBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    problems?: string[];
  };

  return (
    <div className={cn(padding, "px-4")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-8 text-center">{content.title}</h2>
        <ul className="space-y-4">
          {content.problems?.map((problem, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-destructive text-xl">&#10005;</span>
              <span className="text-lg">{problem}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SolutionBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    description?: string;
    bullets?: string[];
  };

  return (
    <div className={cn(padding, "px-4 bg-green-50")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-4 text-center">{content.title}</h2>
        {content.description && (
          <p className="text-lg text-center mb-8">{content.description}</p>
        )}
        <ul className="space-y-3">
          {content.bullets?.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-green-600 text-xl">&#10003;</span>
              <span className="text-lg">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeaturesBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    features?: Array<{ title: string; description: string }>;
  };

  return (
    <div className={cn(padding, "px-4")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-8 text-center">{content.title}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {content.features?.map((feature, i) => (
            <div key={i} className="p-6 border rounded-lg">
              <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestimonialsBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    items?: Array<{ name: string; quote: string; role?: string }>;
  };

  return (
    <div className={cn(padding, "px-4 bg-gray-50")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-8 text-center">{content.title}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {content.items?.map((item, i) => (
            <div key={i} className="p-6 bg-white rounded-lg shadow-sm">
              <p className="text-lg mb-4">「{item.quote}」</p>
              <p className="font-medium">{item.name}</p>
              {item.role && <p className="text-sm text-muted-foreground">{item.role}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PricingBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    plans?: Array<{
      name: string;
      price: string;
      features: string[];
      cta_text: string;
    }>;
  };

  return (
    <div className={cn(padding, "px-4")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-8 text-center">{content.title}</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {content.plans?.map((plan, i) => (
            <div key={i} className="p-6 border-2 border-primary rounded-lg text-center">
              <h3 className="font-bold text-xl mb-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-primary mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6 text-left">
                {plan.features?.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2">
                    <span className="text-green-600">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">
                {plan.cta_text}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BonusBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    bonuses?: Array<{ title: string; value?: string; description: string }>;
  };

  return (
    <div className={cn(padding, "px-4 bg-yellow-50")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-8 text-center">{content.title}</h2>
        <div className="space-y-4">
          {content.bonuses?.map((bonus, i) => (
            <div key={i} className="p-4 bg-white rounded-lg border-l-4 border-yellow-500">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg">{bonus.title}</h3>
                {bonus.value && (
                  <span className="text-yellow-600 font-medium">{bonus.value}</span>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{bonus.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    items?: Array<{ question: string; answer: string }>;
  };

  return (
    <div className={cn(padding, "px-4")} style={style}>
      <div className={cn(width, "mx-auto")}>
        <h2 className="text-3xl font-bold mb-8 text-center">{content.title}</h2>
        <div className="space-y-4">
          {content.items?.map((item, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <h3 className="font-bold mb-2">Q. {item.question}</h3>
              <p className="text-muted-foreground">A. {item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CtaBlock({ block, padding, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    description?: string;
    button_text?: string;
    urgency_text?: string;
  };

  return (
    <div className={cn(padding, "px-4 bg-primary text-primary-foreground")} style={style}>
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">{content.title}</h2>
        {content.description && <p className="text-lg mb-6 opacity-90">{content.description}</p>}
        {content.urgency_text && (
          <p className="text-yellow-300 font-medium mb-4">{content.urgency_text}</p>
        )}
        <button className="bg-white text-primary px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
          {content.button_text}
        </button>
      </div>
    </div>
  );
}

function FormBlock({ block, padding, width, style }: BlockProps) {
  const content = block.content as {
    title?: string;
    fields?: Array<{ name: string; label: string; type: string; required: boolean }>;
    submit_text?: string;
  };

  return (
    <div id="form" className={cn(padding, "px-4 bg-gray-50")} style={style}>
      <div className={cn(width, "mx-auto max-w-md")}>
        <h2 className="text-2xl font-bold mb-6 text-center">{content.title}</h2>
        <div className="space-y-4">
          {content.fields?.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <input
                type={field.type}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={field.label}
              />
            </div>
          ))}
          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
            {content.submit_text}
          </button>
        </div>
      </div>
    </div>
  );
}
