"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

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

export function LPPreview({ blocks }: LPPreviewProps) {
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
    return <HTMLPreview block={htmlBlock} />;
  }

  return (
    <div className="bg-white">
      {typedBlocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}

// HTMLブロック用のプレビューコンポーネント（iframe使用）
function HTMLPreview({ block }: { block: LPBlock }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const content = block.content as { html?: string; css?: string };

  useEffect(() => {
    if (iframeRef.current && content.html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        // HTMLにCSSを埋め込む
        let fullHtml = content.html;
        
        // CSSがある場合は<head>に挿入
        if (content.css) {
          const styleTag = `<style>${content.css}</style>`;
          if (fullHtml.includes("</head>")) {
            fullHtml = fullHtml.replace("</head>", `${styleTag}</head>`);
          } else if (fullHtml.includes("<body")) {
            fullHtml = fullHtml.replace("<body", `<head>${styleTag}</head><body`);
          } else {
            fullHtml = `<style>${content.css}</style>${fullHtml}`;
          }
        }

        doc.open();
        doc.write(fullHtml);
        doc.close();

        // iframe高さを自動調整
        const adjustHeight = () => {
          if (iframeRef.current && doc.body) {
            const height = doc.body.scrollHeight;
            iframeRef.current.style.height = `${Math.max(height, 600)}px`;
          }
        };

        // 画像読み込み完了後に再調整
        const images = doc.images;
        let loadedImages = 0;
        if (images.length === 0) {
          adjustHeight();
        } else {
          for (let i = 0; i < images.length; i++) {
            images[i].onload = () => {
              loadedImages++;
              if (loadedImages === images.length) {
                adjustHeight();
              }
            };
          }
        }

        // 少し遅延させてから高さ調整
        setTimeout(adjustHeight, 100);
        setTimeout(adjustHeight, 500);
      }
    }
  }, [content.html, content.css]);

  if (!content.html) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        HTMLコンテンツがありません
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden border">
      <iframe
        ref={iframeRef}
        className="w-full min-h-[600px] border-0"
        title="LP Preview"
        sandbox="allow-same-origin"
      />
    </div>
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
