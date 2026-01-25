import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram } from "lucide-react";

export default function InstagramPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Instagram</h1>
        <p className="text-muted-foreground">Instagramマーケティングの管理</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="size-5" />
            Instagram投稿管理
          </CardTitle>
          <CardDescription>
            Instagramへの投稿文・ハッシュタグを生成・管理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            キャンペーン詳細ページからInstagram投稿文を生成できます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
