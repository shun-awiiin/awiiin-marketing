import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function LinePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">LINE</h1>
        <p className="text-muted-foreground">LINEマーケティングの管理</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            LINE公式アカウント連携
          </CardTitle>
          <CardDescription>
            LINE公式アカウントと連携して、メッセージ配信やセグメント管理を行います
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            LINE連携機能は準備中です。設定からLINE連携を設定してください。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
