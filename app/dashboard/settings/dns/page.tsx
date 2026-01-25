"use client";

import { useState, useEffect } from "react";
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
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  RefreshCw,
  Info,
  Globe,
} from "lucide-react";
import { ClientDate } from "@/components/ui/client-date";

interface SavedDomain {
  id: string;
  domain: string;
  dkim_selector: string | null;
  spf_valid: boolean;
  dkim_valid: boolean;
  dmarc_valid: boolean;
  dmarc_policy: string | null;
  last_checked_at: string;
}

interface DnsCheckResult {
  domain: string;
  spf: { valid: boolean; record: string | null; error?: string };
  dkim: { valid: boolean; selector: string; record: string | null; error?: string };
  dmarc: { valid: boolean; policy: string | null; record: string | null; error?: string };
  overallValid: boolean;
  canSend: boolean;
  recommendations: string[];
}

export default function DnsSettingsPage() {
  const [domain, setDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DnsCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDomains, setSavedDomains] = useState<SavedDomain[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // 保存済みドメインを読み込む
  useEffect(() => {
    const fetchSavedDomains = async () => {
      try {
        const response = await fetch("/api/dns/check");
        if (response.ok) {
          const data = await response.json();
          setSavedDomains(data.domains || []);
        }
      } catch {
        // エラーは無視（初回は空でOK）
      } finally {
        setLoadingSaved(false);
      }
    };
    fetchSavedDomains();
  }, []);

  // 保存済みドメインを選択
  const handleSelectSaved = (saved: SavedDomain) => {
    setDomain(saved.domain);
    setDkimSelector(saved.dkim_selector || "");
  };

  const handleCheck = async () => {
    if (!domain.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dns/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          domain: domain.trim(),
          dkim_selector: dkimSelector.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("DNSチェックに失敗しました");
      }

      const data = await response.json();
      setResult(data);
      
      // 保存済みリストを更新
      const listResponse = await fetch("/api/dns/check");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setSavedDomains(listData.domains || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ valid }: { valid: boolean }) =>
    valid ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">DNS設定確認</h1>
        <p className="text-muted-foreground">
          送信ドメインのSPF、DKIM、DMARC設定を確認します
        </p>
      </div>

      {/* 保存済みドメイン */}
      {!loadingSaved && savedDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5" />
              保存済みドメイン
            </CardTitle>
            <CardDescription>
              クリックして再チェック
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedDomains.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => handleSelectSaved(saved)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {saved.spf_valid && saved.dkim_valid && saved.dmarc_valid ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{saved.domain}</p>
                      {saved.dkim_selector && (
                        <p className="text-xs text-muted-foreground">
                          セレクター: {saved.dkim_selector}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <ClientDate date={saved.last_checked_at} />
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ドメイン検証
          </CardTitle>
          <CardDescription>
            メール送信元ドメインを入力して、DNS設定を確認してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="domain">送信元ドメイン</Label>
                <Input
                  id="domain"
                  placeholder="例: m.awiiin.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCheck} disabled={loading || !domain.trim()}>
                  {loading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
                  検証
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="dkim-selector">DKIMセレクター（任意）</Label>
              <Input
                id="dkim-selector"
                placeholder="例: ru4vlsprnqg3icvad3ksnlb35etpco5x"
                value={dkimSelector}
                onChange={(e) => setDkimSelector(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Amazon SESの場合はCNAMEレコード名の最初の部分を入力してください。空欄の場合は自動検出を試みます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* 総合結果 */}
          <Card
            className={
              result.canSend
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {result.canSend ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <p className="font-semibold text-lg">
                    {result.canSend
                      ? "送信可能"
                      : "送信不可 - DNS設定が必要です"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.overallValid
                      ? "すべてのDNS設定が正しく構成されています"
                      : "一部の設定に問題があります"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 詳細結果 */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* SPF */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <StatusIcon valid={result.spf.valid} />
                  SPF
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.spf.valid ? (
                  <p className="text-sm text-muted-foreground break-all">
                    {result.spf.record?.substring(0, 100)}
                    {(result.spf.record?.length || 0) > 100 && "..."}
                  </p>
                ) : (
                  <p className="text-sm text-red-600">{result.spf.error}</p>
                )}
              </CardContent>
            </Card>

            {/* DKIM */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <StatusIcon valid={result.dkim.valid} />
                  DKIM
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.dkim.valid ? (
                  <p className="text-sm text-muted-foreground">
                    セレクタ: {result.dkim.selector}
                  </p>
                ) : (
                  <p className="text-sm text-red-600">{result.dkim.error}</p>
                )}
              </CardContent>
            </Card>

            {/* DMARC */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <StatusIcon valid={result.dmarc.valid} />
                  DMARC
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.dmarc.valid ? (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      ポリシー:{" "}
                      <span
                        className={
                          result.dmarc.policy === "reject"
                            ? "text-green-600 font-medium"
                            : result.dmarc.policy === "quarantine"
                            ? "text-yellow-600 font-medium"
                            : "text-orange-600"
                        }
                      >
                        {result.dmarc.policy || "不明"}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-red-600">{result.dmarc.error}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 推奨事項 */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  改善推奨事項
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 設定ガイド */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">設定ガイド</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">SPFレコード（例）</h4>
                <code className="block bg-muted p-2 rounded text-sm">
                  v=spf1 include:amazonses.com ~all
                </code>
              </div>
              <div>
                <h4 className="font-medium mb-1">DMARCレコード（最低限）</h4>
                <code className="block bg-muted p-2 rounded text-sm">
                  v=DMARC1; p=none; rua=mailto:dmarc@{result.domain}
                </code>
              </div>
              <div>
                <h4 className="font-medium mb-1">DKIM</h4>
                <p className="text-sm text-muted-foreground">
                  Amazon SESコンソールで「Easy DKIM」を有効にし、
                  表示される3つのCNAMEレコードをDNSに追加してください。
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
