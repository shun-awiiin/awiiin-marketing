import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XIcon } from "@/components/icons/x-icon";

export default function XPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">X (Twitter)</h1>
        <p className="text-muted-foreground">Xでのソーシャルマーケティング管理</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XIcon className="size-5" />
            X投稿管理
          </CardTitle>
          <CardDescription>
            Xへの投稿文を生成・管理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            キャンペーン詳細ページからX投稿文を生成できます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
