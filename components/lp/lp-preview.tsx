"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw, GripVertical, ChevronUp, ChevronDown, Trash2 } from "lucide-react";

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
}

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
}: { 
  block: LPBlock;
  editable?: boolean;
  onSectionEdit?: (section: LPSection, instruction: string) => void;
  onSectionRegenerate?: (sectionType: string) => void;
  onSectionsReorder?: (sections: LPSection[]) => void;
  onSectionDelete?: (sectionId: string) => void;
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
  const [editInstruction, setEditInstruction] = useState("");

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

  if (!sections.length) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        セクションがありません
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
      <div className="bg-white rounded-lg overflow-hidden border">
        <IframePreview html={fullHtml} />
      </div>

      {/* 編集モード時のセクションリスト */}
      {editable && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">セクション編集</h3>
          {sections.sort((a, b) => a.order - b.order).map((section, index) => (
            <div 
              key={section.id} 
              className="border rounded-lg p-3 bg-card"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <span className="font-medium">
                    {sectionTypeLabels[section.type] || section.type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMoveSection(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMoveSection(index, "down")}
                    disabled={index === sections.length - 1}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onSectionRegenerate?.(section.type)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onSectionDelete?.(section.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* 編集フォーム */}
              {editingSection === section.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full p-2 border rounded text-sm"
                    rows={2}
                    placeholder="編集指示を入力（例：見出しをもっとインパクトのあるものに変更）"
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleEditSubmit(section)}
                      disabled={!editInstruction.trim()}
                    >
                      編集を適用
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingSection(null);
                        setEditInstruction("");
                      }}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      sandbox="allow-same-origin"
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
