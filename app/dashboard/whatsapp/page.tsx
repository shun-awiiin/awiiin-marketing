import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export default function WhatsAppPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp</h1>
        <p className="text-muted-foreground">WhatsAppマーケティングの管理</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            WhatsApp DM管理
          </CardTitle>
          <CardDescription>
            WhatsApp DMテンプレートを生成・管理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            キャンペーン詳細ページからWhatsApp DM文を生成できます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
