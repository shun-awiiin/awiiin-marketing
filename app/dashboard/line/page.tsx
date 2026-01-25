import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Users, Send } from "lucide-react";

export default function LinePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">LINE</h1>
        <p className="text-muted-foreground">LINEマーケティングの管理</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-5" />
              LINE公式アカウント連携
            </CardTitle>
            <CardDescription>
              LINE公式アカウントと連携してメッセージ配信
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              LINE公式アカウントを連携すると、セグメント配信やシナリオ配信が利用できます。
            </p>
            <Button asChild>
              <Link href="/dashboard/settings/line">
                <Settings className="mr-2 size-4" />
                LINE連携設定
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              友だち管理
            </CardTitle>
            <CardDescription>
              LINE友だちのセグメント・タグ管理
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              連絡先に登録されたLINE友だちを管理・セグメント分けできます。
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/contacts">
                <Users className="mr-2 size-4" />
                連絡先一覧へ
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            シナリオ配信
          </CardTitle>
          <CardDescription>
            LINEでのステップ配信・自動応答を設定
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            友だち追加時の自動応答や、条件に応じたステップ配信を設定できます。
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/scenarios">
              シナリオ一覧へ
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
