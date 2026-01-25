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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MoreHorizontal, Eye, Edit, Trash2, Copy, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  product_type: "one_time" | "subscription" | "payment_plan";
  price: number;
  currency: string;
  status: "active" | "inactive" | "archived";
  total_sales: number;
  total_revenue: number;
  created_at: string;
}

interface Purchase {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  products: { name: string } | null;
  customers: { email: string } | null;
}

interface ProductListClientProps {
  products: Product[];
  recentPurchases: Purchase[];
}

const productTypeLabels: Record<string, string> = {
  one_time: "単発",
  subscription: "サブスク",
  payment_plan: "分割",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "販売中", variant: "default" },
  inactive: { label: "停止中", variant: "secondary" },
  archived: { label: "アーカイブ", variant: "outline" },
};

export function ProductListClient({ products, recentPurchases }: ProductListClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("この商品を削除しますか？")) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      toast.success("商品を削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCopyCheckoutUrl = (id: string) => {
    const url = `${window.location.origin}/api/checkout/create?product_id=${id}`;
    navigator.clipboard.writeText(url);
    toast.success("決済URLをコピーしました");
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const totalRevenue = products.reduce((sum, p) => sum + p.total_revenue, 0);
  const totalSales = products.reduce((sum, p) => sum + p.total_sales, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総売上</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(totalRevenue, "jpy")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総販売数</CardDescription>
            <CardTitle className="text-2xl">{totalSales}件</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>商品数</CardDescription>
            <CardTitle className="text-2xl">{products.length}件</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">商品一覧</TabsTrigger>
          <TabsTrigger value="purchases">最近の購入</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>商品一覧</CardTitle>
                <CardDescription>
                  {products.length}件の商品があります
                </CardDescription>
              </div>
              <Link href="/dashboard/payment/products/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  新規商品
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">商品がありません</h3>
                  <p className="text-muted-foreground mb-4">
                    最初の商品を作成して販売を開始しましょう
                  </p>
                  <Link href="/dashboard/payment/products/new">
                    <Button>
                      <Plus className="size-4 mr-2" />
                      商品を作成
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名</TableHead>
                      <TableHead>タイプ</TableHead>
                      <TableHead>価格</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">販売数</TableHead>
                      <TableHead className="text-right">売上</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const status = statusLabels[product.status] || statusLabels.active;

                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {product.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {productTypeLabels[product.product_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(product.price, product.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {product.total_sales}件
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(product.total_revenue, product.currency)}
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
                                  <Link href={`/dashboard/payment/products/${product.id}`}>
                                    <Eye className="size-4 mr-2" />
                                    詳細
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/payment/products/${product.id}/edit`}>
                                    <Edit className="size-4 mr-2" />
                                    編集
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyCheckoutUrl(product.id)}>
                                  <Copy className="size-4 mr-2" />
                                  決済URLをコピー
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(product.id)}
                                  disabled={isDeleting === product.id}
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>最近の購入</CardTitle>
              <CardDescription>直近10件の購入履歴</CardDescription>
            </CardHeader>
            <CardContent>
              {recentPurchases.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">購入履歴がありません</h3>
                  <p className="text-muted-foreground">
                    購入が発生すると、ここに表示されます
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>顧客</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{purchase.products?.name || "-"}</TableCell>
                        <TableCell>{purchase.customers?.email || "-"}</TableCell>
                        <TableCell>{formatCurrency(purchase.amount, "jpy")}</TableCell>
                        <TableCell>
                          <Badge variant={purchase.status === "completed" ? "default" : "secondary"}>
                            {purchase.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(purchase.created_at).toLocaleString("ja-JP")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
