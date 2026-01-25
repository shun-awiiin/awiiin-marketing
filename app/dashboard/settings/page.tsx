"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, User, Mail, Settings, Shield, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCurrentUser, hasRole } from "@/lib/hooks/use-current-user";

export default function SettingsPage() {
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [settings, setSettings] = useState({
    emailProvider: "ses",
    sendFromEmail: "",
    sendFromName: "",
    dailyLimit: "500",
    sendInterval: "2",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const supabase = createClient();
  const currentUser = useCurrentUser();
  const isAdmin = hasRole(currentUser.role, "admin");

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          email: authUser.email ?? "",
          name: authUser.user_metadata?.name ?? "",
        });

        // ユーザー設定を取得
        const { data: userData } = await supabase
          .from("users")
          .select("settings")
          .eq("id", authUser.id)
          .single();

        if (userData?.settings) {
          setSettings((prev) => ({ ...prev, ...userData.settings }));
        }
      }
    };
    fetchUser();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { error } = await supabase
          .from("users")
          .upsert({
            id: authUser.id,
            email: authUser.email,
            settings
          }, { onConflict: "id" });

        if (error) throw error;

        setMessage({ type: "success", text: "設定を保存しました" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "設定の保存に失敗しました" });
    }

    setSaving(false);
  };

  const roleLabels: Record<string, string> = {
    admin: "管理者",
    editor: "編集者",
    viewer: "閲覧者",
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">設定</h1>
          <p className="text-muted-foreground">
            アカウントとメール配信の設定を管理
          </p>
        </div>
        {!currentUser.isLoading && (
          <Badge variant="outline" className="text-sm">
            {roleLabels[currentUser.role] || currentUser.role}
          </Badge>
        )}
      </div>

      {isAdmin && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              管理者メニュー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings/users">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium">ユーザー管理</p>
                  <p className="text-sm text-muted-foreground">
                    ユーザーのロールと権限を管理
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      )}

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            アカウント情報
          </CardTitle>
          <CardDescription>
            登録済みのアカウント情報を確認できます
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>メールアドレス</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label>名前</Label>
            <Input value={user?.name ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            メール送信設定
          </CardTitle>
          <CardDescription>
            メール送信に関する設定を行います
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider">メール送信プロバイダー</Label>
            <Select
              value={settings.emailProvider}
              onValueChange={(value) =>
                setSettings({ ...settings, emailProvider: value })
              }
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">開発モード（送信しない）</SelectItem>
                <SelectItem value="ses">Amazon SES</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              プロバイダーは環境変数で設定されます。この設定は表示用です。
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fromEmail">送信元メールアドレス</Label>
            <Input
              id="fromEmail"
              placeholder="noreply@yourdomain.com"
              value={settings.sendFromEmail}
              onChange={(e) =>
                setSettings({ ...settings, sendFromEmail: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fromName">送信者名</Label>
            <Input
              id="fromName"
              placeholder="株式会社サンプル"
              value={settings.sendFromName}
              onChange={(e) =>
                setSettings({ ...settings, sendFromName: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            配信制限設定
          </CardTitle>
          <CardDescription>
            到達率を維持するための配信制限を設定します
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dailyLimit">1日あたりの送信上限</Label>
            <Select
              value={settings.dailyLimit}
              onValueChange={(value) =>
                setSettings({ ...settings, dailyLimit: value })
              }
            >
              <SelectTrigger id="dailyLimit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100通</SelectItem>
                <SelectItem value="500">500通</SelectItem>
                <SelectItem value="1000">1,000通</SelectItem>
                <SelectItem value="5000">5,000通</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sendInterval">送信間隔（秒）</Label>
            <Select
              value={settings.sendInterval}
              onValueChange={(value) =>
                setSettings({ ...settings, sendInterval: value })
              }
            >
              <SelectTrigger id="sendInterval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1秒</SelectItem>
                <SelectItem value="2">2秒（推奨）</SelectItem>
                <SelectItem value="5">5秒</SelectItem>
                <SelectItem value="10">10秒</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              到達率を高めるため、2秒以上の間隔を推奨します
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "設定を保存"}
        </Button>
      </div>
    </div>
  );
}
