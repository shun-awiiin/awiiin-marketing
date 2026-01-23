"use client";

import React from "react";

import { useState, useCallback } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface CSVImportDialogProps {
  userId: string;
  onComplete: () => void;
  onClose: () => void;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: Array<{ row: number; email: string; reason: string }>;
  existingInDb?: number;
  alreadyExisted?: number;
}

export function CSVImportDialog({
  userId,
  onComplete,
  onClose,
}: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!selectedFile.name.endsWith(".csv")) {
        setError("CSVファイルを選択してください");
        return;
      }

      setFile(selectedFile);
      setError(null);

      // Preview file to count rows
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          setError("有効なデータがありません");
          setPreviewCount(0);
          return;
        }

        // Check for email column (support HubSpot format)
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ''));
        const hasEmail = headers.some((h) =>
          ["email", "eメール", "メール", "メールアドレス", "e-mail"].includes(h)
        );

        if (!hasEmail) {
          setError(
            "emailカラムが見つかりません。CSVに「email」または「Eメール」ヘッダーを含めてください。"
          );
          setPreviewCount(0);
          return;
        }

        setPreviewCount(lines.length - 1); // Exclude header
      };

      reader.readAsText(selectedFile);
    },
    []
  );

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("update_existing", updateExisting.toString());

      const response = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "インポートに失敗しました");
        setImporting(false);
        return;
      }

      setResult(data.data);
    } catch (err) {
      setError("インポート中にエラーが発生しました");
    }

    setImporting(false);
  };

  const handleClose = () => {
    if (result) {
      onComplete();
    } else {
      onClose();
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>CSVインポート</DialogTitle>
        <DialogDescription>
          CSVファイルから連絡先を一括インポートします
        </DialogDescription>
      </DialogHeader>

      {result ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <div className="text-center">
            <p className="font-medium">インポート完了</p>
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <p>処理対象: {result.total}件</p>
              <p className="text-green-600 font-medium">新規追加: {result.created}件</p>
              <p>更新: {result.updated}件</p>
              {result.skipped > 0 && <p>CSV内重複: {result.skipped}件</p>}
              {result.invalid > 0 && (
                <p className="text-orange-600">無効（メール空など）: {result.invalid}件</p>
              )}
              {result.alreadyExisted !== undefined && result.alreadyExisted > 0 && (
                <p className="text-blue-600 text-xs mt-2">
                  ※ 既にDB内に存在: {result.alreadyExisted}件
                </p>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 text-left p-3 bg-muted rounded-lg max-h-32 overflow-auto">
                <p className="font-medium text-xs mb-1">エラー詳細:</p>
                {result.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    行{err.row}: {err.reason}
                  </p>
                ))}
                {result.errors.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ...他{result.errors.length - 5}件のエラー
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : importing ? (
        <div className="flex flex-col gap-4 py-6">
          <Progress value={50} className="animate-pulse" />
          <p className="text-center text-sm text-muted-foreground">
            インポート処理中...
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="border-2 border-dashed rounded-lg p-6">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              {file ? (
                <>
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {previewCount}件の連絡先を検出
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">CSVファイルを選択</p>
                  <p className="text-sm text-muted-foreground">
                    クリックしてファイルを選択
                  </p>
                </>
              )}
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="update-existing"
              checked={updateExisting}
              onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
            />
            <Label htmlFor="update-existing" className="text-sm">
              既存の連絡先を更新する
            </Label>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
            <p className="font-medium mb-1">対応フォーマット:</p>
            <p className="mb-1">・標準: email, firstName, company, tags</p>
            <p className="mb-1">・HubSpot: Eメール, 名, 姓, Associated Company</p>
            <p className="mt-2 text-green-600">✓ HubSpotからのエクスポートCSVに対応</p>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          {result ? "完了" : "キャンセル"}
        </Button>
        {!result && !importing && (
          <Button onClick={handleImport} disabled={previewCount === 0}>
            {previewCount}件をインポート
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
