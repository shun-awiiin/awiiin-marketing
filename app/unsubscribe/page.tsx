"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Mail, AlertCircle } from "lucide-react";
import Loading from "./loading"; // Import the Loading component

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "confirm" | "success" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
      setStatus("confirm");
    } else {
      setStatus("error");
    }
  }, [searchParams]);

  const handleUnsubscribe = async () => {
    if (!email) return;
    setLoading(true);

    try {
      // 配信停止リストに追加
      await supabase
        .from("unsubscribes")
        .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

      // 連絡先のステータスを更新
      await supabase
        .from("contacts")
        .update({ status: "unsubscribed" })
        .eq("email", email);

      // イベントログを記録
      const campaignId = searchParams.get("campaign");
      await supabase.from("events").insert({
        event_type: "unsubscribe",
        email,
        campaign_id: campaignId,
      });

      setStatus("success");
    } catch (error) {
      console.error("Unsubscribe error:", error);
      setStatus("error");
    }

    setLoading(false);
  };

  if (status === "loading") {
    return null; // Return null for loading state
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>エラー</CardTitle>
            <CardDescription>
              無効なリンクです。メールに記載されたリンクから再度お試しください。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>配信停止が完了しました</CardTitle>
            <CardDescription>
              {email} へのメール配信を停止しました。
              今後、このメールアドレスへの配信は行われません。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>メール配信の停止</CardTitle>
          <CardDescription>
            以下のメールアドレスへの配信を停止しますか？
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="font-medium">{email}</p>
          </div>
          <Button
            onClick={handleUnsubscribe}
            disabled={loading}
            className="w-full"
          >
            {loading ? "処理中..." : "配信を停止する"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            この操作を行うと、今後このメールアドレスへのメール配信が全て停止されます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<Loading />}> {/* Use the Loading component as fallback */}
      <UnsubscribeContent />
    </Suspense>
  );
}
