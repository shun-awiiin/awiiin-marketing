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
import { Plus, MoreHorizontal, Eye, Edit, Check, X, Users, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Affiliate {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  commission_rate: number;
  status: "pending" | "active" | "suspended";
  total_referrals: number;
  total_earnings: number;
  created_at: string;
}

interface Commission {
  id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  created_at: string;
  affiliates: { name: string; email: string } | null;
  purchases: { amount: number } | null;
}

interface Payout {
  id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  payout_method: string;
  created_at: string;
  affiliates: { name: string; email: string } | null;
}

interface ReferralDashboardClientProps {
  affiliates: Affiliate[];
  pendingCommissions: Commission[];
  recentPayouts: Payout[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "審査中", variant: "secondary" },
  active: { label: "有効", variant: "default" },
  suspended: { label: "停止", variant: "destructive" },
  approved: { label: "承認済", variant: "default" },
  paid: { label: "支払済", variant: "default" },
  rejected: { label: "却下", variant: "destructive" },
  processing: { label: "処理中", variant: "secondary" },
  completed: { label: "完了", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
};

export function ReferralDashboardClient({
  affiliates,
  pendingCommissions,
  recentPayouts,
}: ReferralDashboardClientProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApproveCommission = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/commissions/${id}/approve`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("承認に失敗しました");
      }

      toast.success("コミッションを承認しました");
      router.refresh();
    } catch {
      toast.error("承認に失敗しました");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCommission = async (id: string) => {
    if (!confirm("このコミッションを却下しますか？")) return;

    setProcessingId(id);
    try {
      const response = await fetch(`/api/commissions/${id}/reject`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("却下に失敗しました");
      }

      toast.success("コミッションを却下しました");
      router.refresh();
    } catch {
      toast.error("却下に失敗しました");
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount);
  };

  const totalEarnings = affiliates.reduce((sum, a) => sum + a.total_earnings, 0);
  const totalReferrals = affiliates.reduce((sum, a) => sum + a.total_referrals, 0);
  const pendingAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>アフィリエイター数</CardDescription>
            <CardTitle className="text-2xl">{affiliates.length}人</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総紹介数</CardDescription>
            <CardTitle className="text-2xl">{totalReferrals}件</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総コミッション</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalEarnings)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>未承認コミッション</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(pendingAmount)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="affiliates">
        <TabsList>
          <TabsTrigger value="affiliates">アフィリエイター</TabsTrigger>
          <TabsTrigger value="commissions">
            未承認コミッション
            {pendingCommissions.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCommissions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payouts">支払い履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>アフィリエイター一覧</CardTitle>
                <CardDescription>
                  {affiliates.length}人のアフィリエイターが登録されています
                </CardDescription>
              </div>
              <Link href="/dashboard/referral/affiliates/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  新規追加
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {affiliates.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">アフィリエイターがいません</h3>
                  <p className="text-muted-foreground mb-4">
                    紹介プログラムを開始してアフィリエイターを招待しましょう
                  </p>
                  <Link href="/dashboard/referral/affiliates/new">
                    <Button>
                      <Plus className="size-4 mr-2" />
                      アフィリエイターを追加
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>紹介コード</TableHead>
                      <TableHead>料率</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">紹介数</TableHead>
                      <TableHead className="text-right">総収益</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((affiliate) => {
                      const status = statusLabels[affiliate.status] || statusLabels.pending;

                      return (
                        <TableRow key={affiliate.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{affiliate.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {affiliate.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {affiliate.referral_code}
                            </code>
                          </TableCell>
                          <TableCell>{affiliate.commission_rate}%</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {affiliate.total_referrals}件
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(affiliate.total_earnings)}
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
                                  <Link href={`/dashboard/referral/affiliates/${affiliate.id}`}>
                                    <Eye className="size-4 mr-2" />
                                    詳細
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/referral/affiliates/${affiliate.id}/edit`}>
                                    <Edit className="size-4 mr-2" />
                                    編集
                                  </Link>
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

        <TabsContent value="commissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>未承認コミッション</CardTitle>
              <CardDescription>
                承認待ちのコミッションを確認・処理してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingCommissions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">未承認のコミッションはありません</h3>
                  <p className="text-muted-foreground">
                    新しい紹介があると、ここに表示されます
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>アフィリエイター</TableHead>
                      <TableHead>購入金額</TableHead>
                      <TableHead>コミッション</TableHead>
                      <TableHead>日時</TableHead>
                      <TableHead className="w-[120px]">アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCommissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {commission.affiliates?.name || "-"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {commission.affiliates?.email || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(commission.purchases?.amount || 0)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(commission.amount)}
                        </TableCell>
                        <TableCell>
                          {new Date(commission.created_at).toLocaleString("ja-JP")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveCommission(commission.id)}
                              disabled={processingId === commission.id}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectCommission(commission.id)}
                              disabled={processingId === commission.id}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>支払い履歴</CardTitle>
              <CardDescription>最近の支払い履歴</CardDescription>
            </CardHeader>
            <CardContent>
              {recentPayouts.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">支払い履歴がありません</h3>
                  <p className="text-muted-foreground">
                    コミッションを承認して支払いを実行すると、ここに表示されます
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>アフィリエイター</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>支払い方法</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>日時</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayouts.map((payout) => {
                      const status = statusLabels[payout.status] || statusLabels.pending;

                      return (
                        <TableRow key={payout.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {payout.affiliates?.name || "-"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {payout.affiliates?.email || "-"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(payout.amount)}</TableCell>
                          <TableCell>{payout.payout_method}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(payout.created_at).toLocaleString("ja-JP")}
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
      </Tabs>
    </div>
  );
}
