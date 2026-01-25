"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function GenerateLPPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    productName: "",
    productDescription: "",
    targetAudience: "",
    tone: "professional",
    ctaText: "",
    benefits: "",
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const response = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "生成に失敗しました");
      }

      const data = await response.json();
      toast.success("LPを生成しました");
      router.push(`/dashboard/lp/${data.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成に失敗しました");
    } finally {
      setIsGenerating(false);
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
            商品情報を入力すると、AIが最適なLPを自動生成します
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>商品・サービス情報</CardTitle>
              <CardDescription>
                AIがLPを生成するための情報を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">商品・サービス名 *</Label>
                  <Input
                    id="productName"
                    placeholder="例: プレミアムオンライン講座"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    required
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productDescription">商品説明 *</Label>
                  <Textarea
                    id="productDescription"
                    placeholder="商品やサービスの詳細な説明を入力してください..."
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    rows={4}
                    required
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAudience">ターゲット顧客 *</Label>
                  <Input
                    id="targetAudience"
                    placeholder="例: 30-40代のビジネスパーソン"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    required
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="benefits">主な特徴・メリット</Label>
                  <Textarea
                    id="benefits"
                    placeholder="箇条書きで入力してください（1行に1つ）&#10;例:&#10;・短期間で成果が出る&#10;・専門家によるサポート付き"
                    value={formData.benefits}
                    onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tone">トーン</Label>
                    <Select
                      value={formData.tone}
                      onValueChange={(value) => setFormData({ ...formData, tone: value })}
                      disabled={isGenerating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">プロフェッショナル</SelectItem>
                        <SelectItem value="casual">カジュアル</SelectItem>
                        <SelectItem value="urgent">緊急感</SelectItem>
                        <SelectItem value="friendly">親しみやすい</SelectItem>
                        <SelectItem value="luxury">高級感</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ctaText">CTAボタンのテキスト</Label>
                    <Input
                      id="ctaText"
                      placeholder="例: 今すぐ申し込む"
                      value={formData.ctaText}
                      onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isGenerating} className="w-full">
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      生成中...（30秒〜1分程度かかります）
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      AIでLPを生成
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>生成のヒント</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                より良いLPを生成するために、以下のポイントを意識してください：
              </p>
              <ul className="list-disc pl-4 space-y-2">
                <li>商品の具体的な価値や特徴を詳しく記載</li>
                <li>ターゲット顧客の悩みや課題を明確に</li>
                <li>競合との差別化ポイントを含める</li>
                <li>数字やデータがあれば含める</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
