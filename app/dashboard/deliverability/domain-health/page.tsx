"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { DomainHealthList } from "@/components/deliverability";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DomainHealthRecord {
  domain: string;
  spf_status: "pass" | "fail" | "partial" | "unknown";
  dkim_status: "pass" | "fail" | "partial" | "unknown";
  dmarc_status: "pass" | "fail" | "partial" | "unknown";
  health_score: number;
  recommendations: Array<{
    category: string;
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
    action?: string;
  }>;
  last_checked_at: string;
}

export default function DomainHealthPage() {
  const [records, setRecords] = useState<DomainHealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("");
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchDomainHealth();
  }, []);

  const fetchDomainHealth = async () => {
    try {
      const response = await fetch("/api/domain-health");
      if (response.ok) {
        const { data } = await response.json();
        setRecords(data.domains || []);
      }
    } catch (error) {
      console.error("Failed to fetch domain health:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecheck = async (domain: string) => {
    setIsChecking(true);
    try {
      const response = await fetch("/api/domain-health/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      if (response.ok) {
        await fetchDomainHealth();
      }
    } catch (error) {
      console.error("Failed to recheck domain:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain) return;

    setIsAddingDomain(true);
    try {
      const response = await fetch("/api/domain-health/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain,
          dkim_selector: dkimSelector || undefined,
        }),
      });

      if (response.ok) {
        await fetchDomainHealth();
        setNewDomain("");
        setDkimSelector("");
        setDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to add domain:", error);
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleCheckAll = async () => {
    setIsChecking(true);
    for (const record of records) {
      await handleRecheck(record.domain);
    }
    setIsChecking(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ドメイン健全性</h1>
          <p className="text-muted-foreground">
            SPF、DKIM、DMARCの設定状態を確認できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <Button variant="outline" onClick={handleCheckAll} disabled={isChecking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              すべて再チェック
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                ドメインを追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ドメインを追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="domain">ドメイン名</Label>
                  <Input
                    id="domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="dkim-selector">DKIMセレクター（任意）</Label>
                  <Input
                    id="dkim-selector"
                    value={dkimSelector}
                    onChange={(e) => setDkimSelector(e.target.value)}
                    placeholder="default"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Amazon SESの場合はCNAMEレコード名の最初の部分（例: ru4vlsprnqg3icvad3ksnlb35etpco5x）を入力してください。Google/Microsoft等は空欄で自動検出します。
                  </p>
                </div>
                <Button
                  onClick={handleAddDomain}
                  disabled={isAddingDomain || !newDomain}
                  className="w-full"
                >
                  {isAddingDomain && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  チェックを実行
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Card */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">概要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-700">
                  {records.filter((r) => r.health_score >= 80).length}
                </p>
                <p className="text-sm text-muted-foreground">健全</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-700">
                  {records.filter((r) => r.health_score >= 50 && r.health_score < 80).length}
                </p>
                <p className="text-sm text-muted-foreground">要改善</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-700">
                  {records.filter((r) => r.health_score < 50).length}
                </p>
                <p className="text-sm text-muted-foreground">要対応</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain List */}
      <DomainHealthList
        records={records}
        onRecheck={handleRecheck}
        isRechecking={isChecking}
      />
    </div>
  );
}
