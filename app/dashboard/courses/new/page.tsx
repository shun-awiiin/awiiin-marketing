"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, GraduationCap } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function NewCoursePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    accessType: "lifetime",
    price: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: formData.price ? parseInt(formData.price) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("作成に失敗しました");
      }

      const data = await response.json();
      toast.success("コースを作成しました");
      router.push(`/dashboard/courses/${data.data.id}`);
    } catch {
      toast.error("作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/courses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新規コース作成</h1>
          <p className="text-muted-foreground">
            会員向けの新しいコースを作成します
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>コース情報</CardTitle>
              <CardDescription>
                コースの基本情報を設定してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">コースタイトル *</Label>
                  <Input
                    id="title"
                    placeholder="例: Webマーケティング基礎講座"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        title: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL スラッグ *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">/member/</span>
                    <Input
                      id="slug"
                      placeholder="web-marketing-basics"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">コース説明</Label>
                  <Textarea
                    id="description"
                    placeholder="コースの概要や学習内容を入力..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="accessType">アクセスタイプ</Label>
                    <Select
                      value={formData.accessType}
                      onValueChange={(value) => setFormData({ ...formData, accessType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lifetime">買い切り（無期限）</SelectItem>
                        <SelectItem value="subscription">サブスクリプション</SelectItem>
                        <SelectItem value="limited">期間限定</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">価格（円）</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="例: 29800"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    <Save className="size-4 mr-2" />
                    {isLoading ? "作成中..." : "コースを作成"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>次のステップ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">コースを作成</p>
                  <p className="text-sm text-muted-foreground">基本情報を設定</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">モジュールを追加</p>
                  <p className="text-sm text-muted-foreground">章やセクションを作成</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">レッスンを追加</p>
                  <p className="text-sm text-muted-foreground">動画やテキストを登録</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                  4
                </div>
                <div>
                  <p className="font-medium">公開</p>
                  <p className="text-sm text-muted-foreground">受講者に提供開始</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <GraduationCap className="size-8" />
                <p className="text-sm">
                  コース作成後、モジュールとレッスンを追加して、コンテンツを充実させましょう。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
