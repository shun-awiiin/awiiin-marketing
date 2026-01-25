import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Share2, ExternalLink } from "lucide-react";

export default function WhatsAppPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp</h1>
        <p className="text-muted-foreground">WhatsAppマーケティングの管理</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="size-5" />
              WhatsApp DM文生成
            </CardTitle>
            <CardDescription>
              キャンペーンからWhatsApp DM文を自動生成
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              メールキャンペーンの内容をもとに、WhatsApp用のDMテンプレートを生成します。
            </p>
            <Button asChild>
              <Link href="/dashboard/campaigns">
                <Send className="mr-2 size-4" />
                キャンペーン一覧へ
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="size-5" />
              SNS投稿管理
            </CardTitle>
            <CardDescription>
              投稿の作成・予約・分析を一元管理
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              WhatsApp含む各SNSへの投稿を作成・スケジュール・管理できます。
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/social">
                <ExternalLink className="mr-2 size-4" />
                SNS投稿管理へ
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>使い方</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>キャンペーン一覧から対象のキャンペーンを選択</li>
            <li>キャンペーン詳細ページの「WhatsApp」タブを開く</li>
            <li>「DM文を生成」ボタンをクリック</li>
            <li>生成されたテキストをコピーしてWhatsAppで送信</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
