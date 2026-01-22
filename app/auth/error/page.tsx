import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-xl">認証エラー</CardTitle>
          <CardDescription>
            {error || "認証中にエラーが発生しました。再度お試しください。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/auth/login">
            <Button className="w-full">ログインページへ</Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button variant="outline" className="w-full bg-transparent">
              新規登録
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
