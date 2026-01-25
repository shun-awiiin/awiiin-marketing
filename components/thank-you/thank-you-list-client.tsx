"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Eye, Edit, Trash2, Copy, ExternalLink, Heart } from "lucide-react";
import { toast } from "sonner";

interface ThankYouPage {
  id: string;
  title: string;
  slug: string;
  product_id: string | null;
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  products: { name: string } | null;
}

interface ThankYouListClientProps {
  thankYouPages: ThankYouPage[];
}

export function ThankYouListClient({ thankYouPages }: ThankYouListClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("このサンクスページを削除しますか？")) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/thank-you-pages/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      toast.success("サンクスページを削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCopyUrl = (slug: string) => {
    const url = `${window.location.origin}/ty/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URLをコピーしました");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/dashboard/thank-you/new">
          <Button>
            <Plus className="size-4 mr-2" />
            新規作成
          </Button>
        </Link>
      </div>

      {thankYouPages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">サンクスページがありません</h3>
            <p className="text-muted-foreground mb-4">
              購入完了後に表示するページを作成しましょう
            </p>
            <Link href="/dashboard/thank-you/new">
              <Button>
                <Plus className="size-4 mr-2" />
                サンクスページを作成
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>サンクスページ一覧</CardTitle>
            <CardDescription>
              {thankYouPages.length}件のサンクスページがあります
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>タイトル</TableHead>
                  <TableHead>関連商品</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">表示回数</TableHead>
                  <TableHead>更新日</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thankYouPages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{page.title}</div>
                        <div className="text-sm text-muted-foreground">
                          /ty/{page.slug}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {page.products?.name || (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={page.is_active ? "default" : "secondary"}>
                        {page.is_active ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {page.view_count.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {new Date(page.updated_at).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/ty/${page.slug}`} target="_blank">
                              <ExternalLink className="size-4 mr-2" />
                              プレビュー
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/thank-you/${page.id}`}>
                              <Eye className="size-4 mr-2" />
                              詳細
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/thank-you/${page.id}/edit`}>
                              <Edit className="size-4 mr-2" />
                              編集
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyUrl(page.slug)}>
                            <Copy className="size-4 mr-2" />
                            URLをコピー
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(page.id)}
                            disabled={isDeleting === page.id}
                          >
                            <Trash2 className="size-4 mr-2" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
