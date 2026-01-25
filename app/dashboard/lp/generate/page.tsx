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

type GenerationPhase = "idle" | "analyzing" | "researching" | "planning" | "building" | "complete";

const phaseLabels: Record<GenerationPhase, { label: string; description: string; progress: number }> = {
  idle: { label: "", description: "", progress: 0 },
  analyzing: { label: "画像分析中", description: "参考デザインの構成を解析しています...", progress: 15 },
  researching: { label: "深掘り分析中", description: "AIがターゲットと課題を深掘りしています...", progress: 35 },
  planning: { label: "設計中", description: "LP構成を設計しています...", progress: 55 },
  building: { label: "生成中", description: "高コンバージョンなLPを生成しています...", progress: 80 },
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
      const payload: Record<string, unknown> = {
        ...formData,
        bonuses: bonuses.filter((b) => b.trim() !== ""),
        testimonials: testimonials.filter((t) => t.name.trim() !== "" && t.quote.trim() !== ""),
      };

      // 参考画像がある場合は画像分析から開始
      if (referenceImage && referenceImageFile) {
        setPhase("analyzing");
        const base64Data = referenceImage.split(",")[1];
        payload.referenceImage = base64Data;
        payload.referenceImageMimeType = "image/jpeg";

        setTimeout(() => setPhase("researching"), 2000);
        setTimeout(() => setPhase("planning"), 5000);
        setTimeout(() => setPhase("building"), 8000);
      } else {
        setPhase("researching");
        setTimeout(() => setPhase("planning"), 3000);
        setTimeout(() => setPhase("building"), 6000);
      }

      // 新しいHTML生成APIを使用
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
