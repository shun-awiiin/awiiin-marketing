"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, Loader2, Plus, X, Zap, Target, Gift, Users, Brain, FileText, Wand2, ImageIcon, Upload, Eye } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Testimonial {
  name: string;
  quote: string;
}

// 雰囲気テンプレート
interface MoodTemplate {
  id: string;
  name: string;
  description: string;
  preview: string; // グラデーション色
  keywords: string[];
  colorHint: string;
  toneHint: string;
}

const moodTemplates: MoodTemplate[] = [
  {
    id: "modern",
    name: "モダン・ミニマル",
    description: "洗練されたシンプルさ、余白を活かしたクリーンなデザイン",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    keywords: ["洗練", "シンプル", "クリーン", "現代的"],
    colorHint: "青紫系のグラデーション、白背景、黒テキスト",
    toneHint: "スタイリッシュで都会的、無駄のない表現",
  },
  {
    id: "luxury",
    name: "高級・エレガント",
    description: "上品で落ち着いた印象、信頼感と品質を伝える",
    preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    keywords: ["高級", "エレガント", "上品", "信頼"],
    colorHint: "ダークネイビー、ゴールドアクセント、白テキスト",
    toneHint: "格調高く、落ち着いた大人の雰囲気",
  },
  {
    id: "warm",
    name: "温かみ・親しみ",
    description: "安心感と親近感、人との繋がりを感じさせる",
    preview: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    keywords: ["温かみ", "親しみ", "安心", "優しさ"],
    colorHint: "ピンク〜オレンジ系の暖色、柔らかい印象",
    toneHint: "フレンドリーで寄り添う、共感を呼ぶ表現",
  },
  {
    id: "energetic",
    name: "エネルギッシュ・インパクト",
    description: "力強さと行動力、今すぐ動きたくなる",
    preview: "linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)",
    keywords: ["力強い", "インパクト", "行動", "情熱"],
    colorHint: "赤〜オレンジ、黄色のビビッドな組み合わせ",
    toneHint: "ダイナミックで熱量のある、勢いを感じる表現",
  },
  {
    id: "professional",
    name: "プロフェッショナル・信頼",
    description: "専門性と実績、ビジネス向けの堅実さ",
    preview: "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)",
    keywords: ["プロフェッショナル", "信頼", "実績", "専門性"],
    colorHint: "ネイビー〜ブルー系、グレーアクセント",
    toneHint: "論理的で説得力のある、データに基づく表現",
  },
  {
    id: "natural",
    name: "ナチュラル・オーガニック",
    description: "自然体で健康的、環境や体に優しい印象",
    preview: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    keywords: ["自然", "健康", "オーガニック", "クリーン"],
    colorHint: "グリーン系、アースカラー、白背景",
    toneHint: "穏やかで健全、自然な流れを感じる表現",
  },
  {
    id: "tech",
    name: "テック・イノベーション",
    description: "先進的で革新的、未来を感じさせる",
    preview: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    keywords: ["先進的", "革新", "テクノロジー", "未来"],
    colorHint: "ダークモード、ネオン系アクセント、サイバー感",
    toneHint: "先端技術を感じさせる、可能性を示す表現",
  },
  {
    id: "playful",
    name: "ポップ・カジュアル",
    description: "楽しくて親しみやすい、若々しい印象",
    preview: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    keywords: ["楽しい", "カジュアル", "ポップ", "若々しい"],
    colorHint: "パステルカラー、カラフルなアクセント",
    toneHint: "軽やかで楽しげ、ワクワクする表現",
  },
];

type GenerationPhase = "idle" | "analyzing" | "deep_analysis" | "design_concept" | "building" | "critique" | "complete";

const phaseLabels: Record<GenerationPhase, { label: string; description: string; progress: number }> = {
  idle: { label: "", description: "", progress: 0 },
  analyzing: { label: "画像分析中", description: "参考デザインの構成を解析しています...", progress: 10 },
  deep_analysis: { label: "深層分析中", description: "心理学者・戦略家・行動経済学者が顧客を分析中...", progress: 25 },
  design_concept: { label: "デザイン設計中", description: "Apple/Airbnb出身デザイナーがコンセプトを策定中...", progress: 45 },
  building: { label: "LP生成中", description: "高コンバージョンなLPを生成しています...", progress: 70 },
  critique: { label: "品質チェック中", description: "厳格なクリティックがLPを批評・改善中...", progress: 90 },
  complete: { label: "完了", description: "LPが完成しました！", progress: 100 },
};

export default function GenerateLPPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    product_name: "",
    target_audience: "",
    main_problem: "",
    solution: "",
    price: "",
    urgency: "",
  });
  const [bonuses, setBonuses] = useState<string[]>([""]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [advancedMode, setAdvancedMode] = useState(true); // デフォルトで高品質モード
  const [brandKeywords, setBrandKeywords] = useState<string[]>([""]); // ブランドキーワード
  const [keyFeatures, setKeyFeatures] = useState<string[]>([""]); // 主要特徴
  const [selectedMood, setSelectedMood] = useState<string | null>(null); // 選択した雰囲気テンプレート

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 20MBまで許可（リサイズするので大きめでOK）
      if (file.size > 20 * 1024 * 1024) {
        toast.error("画像サイズは20MB以下にしてください");
        return;
      }

      toast.info("画像を処理中...");

      try {
        // 画像をリサイズしてBase64に変換
        const resizedDataUrl = await resizeImage(file, 2048);
        setReferenceImage(resizedDataUrl);
        setReferenceImageFile(file);
        toast.success("画像をアップロードしました");
      } catch (error) {
        console.error("Image processing error:", error);
        toast.error("画像の処理に失敗しました");
      }
    }
  };

  // 画像をリサイズする関数（縦長・横長どちらも対応）
  const resizeImage = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;

          // 長辺がmaxSizeを超える場合のみリサイズ
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // JPEG形式で圧縮（品質0.85）
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve(dataUrl);
        };

        img.onerror = () => reject(new Error("Image load failed"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = () => {
    setReferenceImage(null);
    setReferenceImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddBonus = () => {
    setBonuses([...bonuses, ""]);
  };

  const handleRemoveBonus = (index: number) => {
    setBonuses(bonuses.filter((_, i) => i !== index));
  };

  const handleBonusChange = (index: number, value: string) => {
    const newBonuses = [...bonuses];
    newBonuses[index] = value;
    setBonuses(newBonuses);
  };

  const handleAddTestimonial = () => {
    setTestimonials([...testimonials, { name: "", quote: "" }]);
  };

  const handleRemoveTestimonial = (index: number) => {
    setTestimonials(testimonials.filter((_, i) => i !== index));
  };

  const handleTestimonialChange = (index: number, field: keyof Testimonial, value: string) => {
    const newTestimonials = [...testimonials];
    newTestimonials[index] = { ...newTestimonials[index], [field]: value };
    setTestimonials(newTestimonials);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      // 選択したテンプレートの情報を取得
      const selectedTemplate = selectedMood ? moodTemplates.find(t => t.id === selectedMood) : null;
      
      // テンプレートのキーワードをブランドキーワードにマージ
      const mergedKeywords = [
        ...brandKeywords.filter((k) => k.trim() !== ""),
        ...(selectedTemplate?.keywords || []),
      ];

      const payload: Record<string, unknown> = {
        ...formData,
        bonuses: bonuses.filter((b) => b.trim() !== ""),
        testimonials: testimonials.filter((t) => t.name.trim() !== "" && t.quote.trim() !== ""),
        advancedMode,
        brand_keywords: mergedKeywords,
        key_features: keyFeatures.filter((f) => f.trim() !== ""),
        // テンプレート情報
        mood_template: selectedTemplate ? {
          name: selectedTemplate.name,
          colorHint: selectedTemplate.colorHint,
          toneHint: selectedTemplate.toneHint,
        } : null,
      };

      // 4段階高品質モードのフェーズ進行
      if (advancedMode) {
        // 参考画像がある場合は画像分析から開始
        if (referenceImage && referenceImageFile) {
          setPhase("analyzing");
          const base64Data = referenceImage.split(",")[1];
          payload.referenceImage = base64Data;
          payload.referenceImageMimeType = "image/jpeg";
          setTimeout(() => setPhase("deep_analysis"), 3000);
        } else {
          setPhase("deep_analysis");
        }
        setTimeout(() => setPhase("design_concept"), referenceImage ? 8000 : 5000);
        setTimeout(() => setPhase("building"), referenceImage ? 15000 : 12000);
        setTimeout(() => setPhase("critique"), referenceImage ? 25000 : 22000);
      } else {
        // 通常モードのフェーズ進行
        if (referenceImage && referenceImageFile) {
          setPhase("analyzing");
          const base64Data = referenceImage.split(",")[1];
          payload.referenceImage = base64Data;
          payload.referenceImageMimeType = "image/jpeg";
          setTimeout(() => setPhase("building"), 3000);
        } else {
          setPhase("building");
        }
      }

      // HTML生成APIを使用
      const response = await fetch("/api/landing-pages/generate-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "生成に失敗しました");
      }

      const data = await response.json();
      const { sections, globalCss, title, meta_description } = data.data;

      setPhase("complete");

      // セクションベースでLPを保存
      const saveResponse = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.product_name || title,
          slug: "lp-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 8),
          blocks: [{
            id: crypto.randomUUID(),
            type: "html",
            content: { 
              sections: sections || [],
              globalCss: globalCss || "",
              meta_description,
            },
            settings: { padding: "none", width: "full" },
          }],
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("LPの保存に失敗しました");
      }

      const savedLP = await saveResponse.json();
      toast.success("LPを生成しました");
      router.push(`/dashboard/lp/${savedLP.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成に失敗しました");
    } finally {
      setIsGenerating(false);
      setPhase("idle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/lp">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">AIでLP生成</h1>
          <p className="text-muted-foreground">
            Google Geminiが高コンバージョンなLPを自動生成します
          </p>
        </div>
      </div>

      <form onSubmit={handleGenerate}>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            {/* 雰囲気テンプレート選択 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  雰囲気を選ぶ
                </CardTitle>
                <CardDescription>
                  LPの雰囲気・トーンを選択してください。選択しない場合は入力内容から自動判定します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {moodTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedMood(selectedMood === template.id ? null : template.id)}
                      disabled={isGenerating}
                      className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                        selectedMood === template.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      <div
                        className="w-full h-8 rounded-md mb-2"
                        style={{ background: template.preview }}
                      />
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {template.description}
                      </div>
                      {selectedMood === template.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {selectedMood && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">選択中: </span>
                      {moodTemplates.find(t => t.id === selectedMood)?.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {moodTemplates.find(t => t.id === selectedMood)?.toneHint}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 参考画像アップロード */}
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="size-5 text-primary" />
                  参考デザイン（任意）
                </CardTitle>
                <CardDescription>
                  参考にしたいLP/Webサイトのスクリーンショットをアップロードすると、
                  そのデザイン構成を解析してLPに反映します
                </CardDescription>
              </CardHeader>
              <CardContent>
                {referenceImage ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video border rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={referenceImage}
                        alt="参考画像"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Eye className="size-4" />
                        この画像の構成を解析してLPを生成します
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveImage}
                        disabled={isGenerating}
                      >
                        <X className="size-4 mr-2" />
                        削除
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="reference-image-input"
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors block"
                  >
                    <Upload className="size-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      クリックして画像をアップロード
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WEBP（縦長フルページOK・自動リサイズ）
                    </p>
                    <input
                      id="reference-image-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isGenerating}
                    />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* 高品質モード設定 */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    4段階高品質モード
                  </CardTitle>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-muted-foreground">
                      {advancedMode ? "ON" : "OFF"}
                    </span>
                    <input
                      type="checkbox"
                      checked={advancedMode}
                      onChange={(e) => setAdvancedMode(e.target.checked)}
                      className="w-10 h-5 rounded-full appearance-none bg-muted checked:bg-primary transition-colors cursor-pointer relative before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-5 before:transition-transform before:shadow"
                      disabled={isGenerating}
                    />
                  </label>
                </div>
                <CardDescription>
                  心理学者・デザイナー・行動経済学者のAIペルソナが順番に分析・設計し、
                  最後に厳格なクリティックが批評・改善を行います
                </CardDescription>
              </CardHeader>
              {advancedMode && (
                <CardContent className="space-y-4 pt-0">
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <div className="font-medium mb-2">4段階プロセス:</div>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>深層分析 - ターゲットの深層心理を3人の専門家が分析</li>
                      <li>デザインコンセプト - Apple/Airbnb出身デザイナーが設計</li>
                      <li>LP構造生成 - 分析結果を反映したLP生成</li>
                      <li>自己批評 - 厳格なクリティックが批評・改善</li>
                    </ol>
                  </div>
                  
                  {/* ブランドキーワード */}
                  <div>
                    <Label className="text-sm font-medium">ブランドキーワード（任意）</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      ブランドの印象を表すキーワード（例：信頼、革新、温かみ）
                    </p>
                    <div className="space-y-2">
                      {brandKeywords.map((keyword, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={keyword}
                            onChange={(e) => {
                              const newKeywords = [...brandKeywords];
                              newKeywords[index] = e.target.value;
                              setBrandKeywords(newKeywords);
                            }}
                            placeholder={`キーワード ${index + 1}`}
                            disabled={isGenerating}
                          />
                          {brandKeywords.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setBrandKeywords(brandKeywords.filter((_, i) => i !== index))}
                              disabled={isGenerating}
                            >
                              <X className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBrandKeywords([...brandKeywords, ""])}
                        disabled={isGenerating}
                      >
                        <Plus className="size-4 mr-2" />
                        追加
                      </Button>
                    </div>
                  </div>

                  {/* 主要特徴 */}
                  <div>
                    <Label className="text-sm font-medium">主要特徴（任意）</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      商品/サービスの主な特徴や強み
                    </p>
                    <div className="space-y-2">
                      {keyFeatures.map((feature, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={feature}
                            onChange={(e) => {
                              const newFeatures = [...keyFeatures];
                              newFeatures[index] = e.target.value;
                              setKeyFeatures(newFeatures);
                            }}
                            placeholder={`特徴 ${index + 1}`}
                            disabled={isGenerating}
                          />
                          {keyFeatures.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setKeyFeatures(keyFeatures.filter((_, i) => i !== index))}
                              disabled={isGenerating}
                            >
                              <X className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setKeyFeatures([...keyFeatures, ""])}
                        disabled={isGenerating}
                      >
                        <Plus className="size-4 mr-2" />
                        追加
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 基本情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  基本情報
                </CardTitle>
                <CardDescription>
                  商品・サービスの核となる情報を入力してください
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product_name">商品・サービス名 *</Label>
                  <Input
                    id="product_name"
                    placeholder="例: オンライン英会話マスターコース"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    required
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solution">提供する解決策 *</Label>
                  <Textarea
                    id="solution"
                    placeholder="例: 1日15分のオンラインレッスンで3ヶ月で日常会話をマスター。ネイティブ講師との実践的な会話練習で、確実に話せるようになります。"
                    value={formData.solution}
                    onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                    rows={3}
                    required
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    あなたの商品・サービスがどのように顧客の問題を解決するかを具体的に
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">価格</Label>
                  <Input
                    id="price"
                    placeholder="例: 月額9,800円"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    disabled={isGenerating}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ターゲット情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="size-5 text-primary" />
                  ターゲット情報
                </CardTitle>
                <CardDescription>
                  誰に向けたLPかを明確にしましょう
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target_audience">ターゲット顧客 *</Label>
                  <Input
                    id="target_audience"
                    placeholder="例: 英語を話せるようになりたい30-40代のビジネスパーソン"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    required
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="main_problem">主な悩み・課題 *</Label>
                  <Textarea
                    id="main_problem"
                    placeholder="例: 英会話スクールに通う時間がない、独学では上達しない、実践的な会話の機会がない"
                    value={formData.main_problem}
                    onChange={(e) => setFormData({ ...formData, main_problem: e.target.value })}
                    rows={3}
                    required
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    ターゲットが抱えている具体的な悩みや課題を入力
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 特典・限定性 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="size-5 text-primary" />
                  特典・限定性
                </CardTitle>
                <CardDescription>
                  コンバージョン率を高める要素を追加しましょう
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>特典・ボーナス</Label>
                  {bonuses.map((bonus, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`特典${index + 1}: 例) オリジナル単語帳PDF`}
                        value={bonus}
                        onChange={(e) => handleBonusChange(index, e.target.value)}
                        disabled={isGenerating}
                      />
                      {bonuses.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveBonus(index)}
                          disabled={isGenerating}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddBonus}
                    disabled={isGenerating}
                  >
                    <Plus className="size-4 mr-2" />
                    特典を追加
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">限定性（期間・人数）</Label>
                  <Input
                    id="urgency"
                    placeholder="例: 先着30名限定で初月50%オフ"
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                    disabled={isGenerating}
                  />
                </div>
              </CardContent>
            </Card>

            {/* お客様の声 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  お客様の声（任意）
                </CardTitle>
                <CardDescription>
                  実際の体験談があれば追加してください
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="space-y-2 p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <Label>お客様 {index + 1}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTestimonial(index)}
                        disabled={isGenerating}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="お名前（例: 田中さん）"
                      value={testimonial.name}
                      onChange={(e) => handleTestimonialChange(index, "name", e.target.value)}
                      disabled={isGenerating}
                    />
                    <Textarea
                      placeholder="感想（例: 3ヶ月で海外旅行で困らなくなりました）"
                      value={testimonial.quote}
                      onChange={(e) => handleTestimonialChange(index, "quote", e.target.value)}
                      rows={2}
                      disabled={isGenerating}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTestimonial}
                  disabled={isGenerating}
                >
                  <Plus className="size-4 mr-2" />
                  お客様の声を追加
                </Button>
              </CardContent>
            </Card>

            {/* 生成状態表示 */}
            {isGenerating && phase !== "idle" && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {phase === "analyzing" && <ImageIcon className="size-5 text-primary animate-pulse" />}
                      {phase === "researching" && <Brain className="size-5 text-primary animate-pulse" />}
                      {phase === "planning" && <FileText className="size-5 text-primary animate-pulse" />}
                      {phase === "building" && <Wand2 className="size-5 text-primary animate-pulse" />}
                      {phase === "complete" && <Sparkles className="size-5 text-green-600" />}
                      <div>
                        <p className="font-medium">{phaseLabels[phase].label}</p>
                        <p className="text-sm text-muted-foreground">{phaseLabels[phase].description}</p>
                      </div>
                    </div>
                    <Progress value={phaseLabels[phase].progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      {referenceImage ? (
                        <>
                          <span>画像解析</span>
                          <span>深掘り</span>
                          <span>設計</span>
                          <span>生成</span>
                        </>
                      ) : (
                        <>
                          <span>深掘り</span>
                          <span>設計</span>
                          <span>生成</span>
                          <span>完了</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 生成ボタン */}
            <Button type="submit" disabled={isGenerating} className="w-full" size="lg">
              {isGenerating ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" />
                  {phaseLabels[phase].label}...
                </>
              ) : (
                <>
                  <Sparkles className="size-5 mr-2" />
                  AIでLPを生成（3段階AI処理）
                </>
              )}
            </Button>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>生成のヒント</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">高CVRのLPに必要な要素</h4>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li>明確なターゲット設定</li>
                    <li>具体的な悩みと解決策</li>
                    <li>数字で示す実績</li>
                    <li>限定性・緊急性</li>
                    <li>社会的証明（お客様の声）</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">入力のコツ</h4>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li>ターゲットは具体的に（年齢、職業、状況）</li>
                    <li>悩みは感情も含めて記載</li>
                    <li>解決策は具体的な方法と期間</li>
                    <li>特典は価値が伝わるように</li>
                  </ul>
                </div>

                <div className="p-3 bg-primary/5 rounded-lg space-y-2">
                  <h4 className="font-medium">3段階AIパイプライン</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Brain className="size-3" />
                      <span>1. 深掘り分析AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="size-3" />
                      <span>2. 構成設計AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wand2 className="size-3" />
                      <span>3. LP生成AI</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Google Geminiが3段階で思考し、高コンバージョンなLPを生成します。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
