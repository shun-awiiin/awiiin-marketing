"use client";

/**
 * Test Send Dialog Component
 * Allows users to send test emails before bulk campaign sending
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Send, Loader2, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TestSendDialogProps {
  campaignId: string;
  campaignName: string;
  disabled?: boolean;
}

interface TestSendResult {
  success: boolean;
  message_id?: string;
  preview?: {
    subject: string;
    body_text: string;
    from: string;
    to: string;
  };
  error?: string;
}

export function TestSendDialog({
  campaignId,
  campaignName,
  disabled = false,
}: TestSendDialogProps) {
  const [open, setOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sampleFirstName, setSampleFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestSendResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset state when opening
      setResult(null);
      setShowPreview(false);
      // Check rate limit
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/test-send`);
        const data = await response.json();
        if (data.success) {
          setRateLimitRemaining(data.data.remaining);
        }
      } catch (e) {
        // Ignore rate limit check errors
      }
    }
  };

  const handleSendTest = async () => {
    if (!recipientEmail) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          include_preview: true,
          sample_first_name: sampleFirstName || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message_id: data.data.message_id,
          preview: data.data.preview,
        });
        setShowPreview(true);
        // Update rate limit
        if (rateLimitRemaining !== null) {
          setRateLimitRemaining(Math.max(0, rateLimitRemaining - 1));
        }
      } else {
        setResult({
          success: false,
          error: data.error || "テスト送信に失敗しました",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: "ネットワークエラーが発生しました",
      });
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Send className="mr-2 h-4 w-4" />
          テスト送信
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>テスト送信</DialogTitle>
          <DialogDescription>
            {campaignName} のテストメールを送信します。
            {rateLimitRemaining !== null && (
              <span className="block mt-1 text-xs">
                残り {rateLimitRemaining} 回送信可能（1時間あたり5回まで）
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="recipient-email">送信先メールアドレス</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="test@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sample-name">
              サンプル名前（差し込み変数用）
              <span className="text-muted-foreground text-xs ml-2">
                省略時は「ご担当者さま」
              </span>
            </Label>
            <Input
              id="sample-name"
              type="text"
              placeholder="田中"
              value={sampleFirstName}
              onChange={(e) => setSampleFirstName(e.target.value)}
              disabled={loading}
            />
          </div>

          {result && (
            <>
              <Separator />
              {result.success ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    テストメールを送信しました。
                    <br />
                    <span className="text-xs text-green-600">
                      Message ID: {result.message_id}
                    </span>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {showPreview && result?.preview && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  送信プレビュー
                </div>
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">件名:</span>
                    <p className="text-sm font-medium">{result.preview.subject}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">差出人:</span>
                    <p className="text-sm">{result.preview.from}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">宛先:</span>
                    <p className="text-sm">{result.preview.to}</p>
                  </div>
                  <Separator className="my-2" />
                  <div>
                    <span className="text-xs text-muted-foreground">本文:</span>
                    <pre className="text-sm whitespace-pre-wrap font-sans mt-1 text-muted-foreground max-h-40 overflow-y-auto">
                      {result.preview.body_text}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            閉じる
          </Button>
          <Button
            onClick={handleSendTest}
            disabled={
              loading ||
              !isValidEmail(recipientEmail) ||
              rateLimitRemaining === 0
            }
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                テスト送信
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
