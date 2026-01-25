import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Youtube } from "lucide-react";

export default function YoutubePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">YouTube</h1>
        <p className="text-muted-foreground">YouTubeコンテンツマーケティングの管理</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="size-5" />
            YouTubeコミュニティ投稿
          </CardTitle>
          <CardDescription>
            YouTubeコミュニティへの投稿文を生成・管理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            キャンペーン詳細ページからYouTube投稿文を生成できます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
