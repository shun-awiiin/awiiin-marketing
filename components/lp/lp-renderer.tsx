"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle, ArrowRight, Star, Clock, Users, Shield } from "lucide-react";

interface LPBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  blocks: LPBlock[];
  settings: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
    showCountdown?: boolean;
    countdownEndDate?: string;
  };
}

interface LPRendererProps {
  landingPage: LandingPage;
}

export function LPRenderer({ landingPage }: LPRendererProps) {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/form-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landing_page_id: landingPage.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error("送信に失敗しました");
      }

      setIsSubmitted(true);
      toast.success("登録が完了しました");
    } catch {
      toast.error("送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = landingPage.settings?.primaryColor || "#2563eb";

  const renderBlock = (block: LPBlock) => {
    switch (block.type) {
      case "hero":
        return (
          <section key={block.id} className="py-20 px-4 text-center bg-gradient-to-b from-background to-muted/50">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                {(block.content.headline as string) || "メインヘッドライン"}
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-8">
                {(block.content.subheadline as string) || "サブヘッドライン"}
              </p>
              {block.content.ctaText && (
                <Button
                  size="lg"
                  className="text-lg px-8"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {block.content.ctaText as string}
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              )}
            </div>
          </section>
        );

      case "problem":
        return (
          <section key={block.id} className="py-16 px-4 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-center">
                {(block.content.title as string) || "こんなお悩みありませんか？"}
              </h2>
              <div className="space-y-4">
                {((block.content.problems as string[]) || []).map((problem, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-background rounded-lg shadow-sm"
                  >
                    <span className="text-destructive text-2xl">!</span>
                    <p className="text-lg">{problem}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case "solution":
        return (
          <section key={block.id} className="py-16 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-6">
                {(block.content.title as string) || "解決策"}
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                {(block.content.description as string) || ""}
              </p>
              {((block.content.benefits as string[]) || []).length > 0 && (
                <div className="grid md:grid-cols-3 gap-6">
                  {(block.content.benefits as string[]).map((benefit, index) => (
                    <div key={index} className="p-6 bg-muted/30 rounded-lg">
                      <CheckCircle className="size-8 mb-4 mx-auto" style={{ color: primaryColor }} />
                      <p className="font-medium">{benefit}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );

      case "features":
        return (
          <section key={block.id} className="py-16 px-4 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-center">
                {(block.content.title as string) || "特徴"}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {((block.content.features as Array<{ title: string; description: string }>) || []).map(
                  (feature, index) => (
                    <div key={index} className="p-6 bg-background rounded-lg shadow-sm">
                      <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>
        );

      case "testimonials":
        return (
          <section key={block.id} className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-center">
                {(block.content.title as string) || "お客様の声"}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {((block.content.testimonials as Array<{ name: string; role: string; content: string }>) || []).map(
                  (testimonial, index) => (
                    <div key={index} className="p-6 bg-muted/30 rounded-lg">
                      <div className="flex gap-1 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className="size-5 fill-yellow-400 text-yellow-400"
                          />
                        ))}
                      </div>
                      <p className="mb-4 italic">&quot;{testimonial.content}&quot;</p>
                      <div className="font-medium">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>
        );

      case "pricing":
        return (
          <section key={block.id} className="py-16 px-4 bg-muted/30">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                {(block.content.title as string) || "価格"}
              </h2>
              <div className="p-8 bg-background rounded-xl shadow-lg">
                {block.content.originalPrice && (
                  <div className="text-lg text-muted-foreground line-through mb-2">
                    通常価格: {(block.content.originalPrice as number).toLocaleString()}円
                  </div>
                )}
                <div className="text-5xl font-bold mb-4" style={{ color: primaryColor }}>
                  {((block.content.price as number) || 0).toLocaleString()}
                  <span className="text-lg">円</span>
                </div>
                {block.content.priceNote && (
                  <p className="text-muted-foreground mb-6">{block.content.priceNote as string}</p>
                )}
                <Button
                  size="lg"
                  className="w-full text-lg"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  今すぐ申し込む
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </div>
            </div>
          </section>
        );

      case "bonus":
        return (
          <section key={block.id} className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-center">
                {(block.content.title as string) || "特典"}
              </h2>
              <div className="space-y-4">
                {((block.content.bonuses as Array<{ title: string; description: string; value?: string }>) || []).map(
                  (bonus, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
                    >
                      <span className="text-2xl">🎁</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{bonus.title}</h3>
                          {bonus.value && (
                            <span className="text-sm px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                              {bonus.value}円相当
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">{bonus.description}</p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>
        );

      case "faq":
        return (
          <section key={block.id} className="py-16 px-4 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-center">
                {(block.content.title as string) || "よくある質問"}
              </h2>
              <div className="space-y-4">
                {((block.content.faqs as Array<{ question: string; answer: string }>) || []).map(
                  (faq, index) => (
                    <div key={index} className="p-6 bg-background rounded-lg shadow-sm">
                      <h3 className="font-bold mb-2">Q: {faq.question}</h3>
                      <p className="text-muted-foreground">A: {faq.answer}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>
        );

      case "form":
        return (
          <section key={block.id} id="form-section" className="py-16 px-4">
            <div className="max-w-xl mx-auto">
              <h2 className="text-3xl font-bold mb-4 text-center">
                {(block.content.title as string) || "今すぐ登録"}
              </h2>
              {block.content.description && (
                <p className="text-center text-muted-foreground mb-8">
                  {block.content.description as string}
                </p>
              )}

              {isSubmitted ? (
                <div className="text-center p-8 bg-green-50 rounded-lg">
                  <CheckCircle className="size-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">登録が完了しました</h3>
                  <p className="text-muted-foreground">
                    確認メールをお送りしましたので、ご確認ください。
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 p-8 bg-muted/30 rounded-lg">
                  <div>
                    <Input
                      type="text"
                      placeholder="お名前"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      type="email"
                      placeholder="メールアドレス"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-lg"
                    style={{ backgroundColor: primaryColor }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "送信中..." : (block.content.buttonText as string) || "登録する"}
                  </Button>

                  <div className="flex justify-center gap-6 text-sm text-muted-foreground pt-4">
                    <div className="flex items-center gap-1">
                      <Shield className="size-4" />
                      SSL暗号化
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="size-4" />
                      {(block.content.socialProof as string) || "1,000名以上が登録"}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </section>
        );

      case "video":
        return (
          <section key={block.id} className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              {block.content.title && (
                <h2 className="text-3xl font-bold mb-8 text-center">
                  {block.content.title as string}
                </h2>
              )}
              <div className="aspect-video">
                <iframe
                  className="w-full h-full rounded-lg"
                  src={block.content.youtubeUrl as string}
                  title="Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </section>
        );

      case "countdown":
        return (
          <section
            key={block.id}
            className="py-4 px-4 text-center text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="size-5" />
              <span className="font-bold">
                {(block.content.message as string) || "特別価格は本日限り"}
              </span>
            </div>
          </section>
        );

      case "cta":
        return (
          <section
            key={block.id}
            className="py-16 px-4 text-center text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">
                {(block.content.headline as string) || "今すぐ始めましょう"}
              </h2>
              <p className="text-xl mb-8 opacity-90">
                {(block.content.subheadline as string) || ""}
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8"
                onClick={() => {
                  document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {(block.content.buttonText as string) || "申し込む"}
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {(landingPage.blocks || []).map(renderBlock)}

      <footer className="py-8 px-4 text-center text-sm text-muted-foreground border-t">
        <p>Copyright &copy; {new Date().getFullYear()} All rights reserved.</p>
        <div className="mt-2 space-x-4">
          <a href="/privacy" className="hover:underline">
            プライバシーポリシー
          </a>
          <a href="/terms" className="hover:underline">
            利用規約
          </a>
          <a href="/tokushoho" className="hover:underline">
            特定商取引法に基づく表記
          </a>
        </div>
      </footer>
    </div>
  );
}
