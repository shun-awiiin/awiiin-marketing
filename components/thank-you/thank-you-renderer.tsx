"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Download, Mail, MessageSquare, PlayCircle } from "lucide-react";

interface ThankYouPage {
  id: string;
  title: string;
  slug: string;
  headline: string;
  message: string;
  video_url: string | null;
  redirect_url: string | null;
  redirect_delay: number | null;
  show_social_links: boolean;
  next_steps: Array<{ title: string; description: string; link?: string }> | null;
  products: { name: string; description: string } | null;
}

interface ThankYouRendererProps {
  page: ThankYouPage;
}

export function ThankYouRenderer({ page }: ThankYouRendererProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
            <CheckCircle className="size-12 text-green-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {page.headline || "ありがとうございます！"}
          </h1>
          <p className="text-xl text-muted-foreground">
            {page.message || "お申し込みが完了しました。"}
          </p>
        </div>

        {page.products && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>ご購入いただいた商品</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="font-bold text-lg">{page.products.name}</h3>
              {page.products.description && (
                <p className="text-muted-foreground mt-2">{page.products.description}</p>
              )}
            </CardContent>
          </Card>
        )}

        {page.video_url && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="size-5" />
                まずはこちらの動画をご覧ください
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video">
                <iframe
                  className="w-full h-full rounded-lg"
                  src={page.video_url}
                  title="Welcome Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </CardContent>
          </Card>
        )}

        {page.next_steps && page.next_steps.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>次のステップ</CardTitle>
              <CardDescription>以下の手順に従って始めましょう</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {page.next_steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">{step.title}</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        {step.description}
                      </p>
                      {step.link && (
                        <Link
                          href={step.link}
                          className="inline-flex items-center gap-1 text-primary text-sm mt-2 hover:underline"
                        >
                          詳しくはこちら
                          <ArrowRight className="size-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              確認メールをお送りしました
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              ご登録いただいたメールアドレスに確認メールをお送りしました。
              届いていない場合は、迷惑メールフォルダをご確認ください。
            </p>
          </CardContent>
        </Card>

        {page.show_social_links && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>SNSでつながりましょう</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button variant="outline" className="flex-1">
                  <MessageSquare className="size-4 mr-2" />
                  LINE登録
                </Button>
                <Button variant="outline" className="flex-1">
                  公式Twitter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {page.redirect_url && (
          <div className="text-center">
            <Link href={page.redirect_url}>
              <Button size="lg">
                会員サイトへ進む
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <footer className="py-8 px-4 text-center text-sm text-muted-foreground border-t">
        <p>Copyright &copy; {new Date().getFullYear()} All rights reserved.</p>
      </footer>
    </div>
  );
}
