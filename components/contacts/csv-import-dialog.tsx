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
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { ImportSettings, useImportSettings } from "./import-settings";
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

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
  const orgFetch = useOrgFetch();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][] | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    settings: importSettings,
    setSettings: setImportSettings,
    tags,
    lists,
    isLoading: isSettingsLoading,
    reset: resetSettings
  } = useImportSettings();

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && text[i + 1] === "\n") {
          i++;
        }
        row.push(current);
        current = "";
        if (row.some((field) => field.trim() !== "")) {
          rows.push(row);
        }
        row = [];
      } else {
        current += char;
      }
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current);
      if (row.some((field) => field.trim() !== "")) {
        rows.push(row);
      }
    }

    return rows;
  };

  const serializeRow = (fields: string[]) => {
    return fields
      .map((field) => {
        const value = field ?? "";
        const escaped = value.replace(/"/g, '""');
        return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
      })
      .join(",");
  };

  const buildCSV = (rows: string[][]) => {
    return rows.map(serializeRow).join("\n");
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!selectedFile.name.endsWith(".csv")) {
        setError("CSVファイルを選択してください");
        return;
      }

      setFile(selectedFile);
      setParsedRows(null);
      setError(null);

      // Preview file to count rows
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length < 2) {
          setError("有効なデータがありません");
          setPreviewCount(0);
          return;
        }

        // Check for email column (support HubSpot format)
        const headers = rows[0].map((h) =>
          h.replace(/^\ufeff/, "").trim().toLowerCase().replace(/"/g, "")
        );
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

        setParsedRows(rows);
        setPreviewCount(rows.length - 1); // Exclude header
      };

      reader.readAsText(selectedFile);
    },
    []
  );

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    setProgress(0);

    try {
      const rows = parsedRows ?? parseCSV(await file.text());
      if (rows.length < 2) {
        setError("有効なデータがありません");
        setImporting(false);
        return;
      }

      const header = rows[0];
      const dataRows = rows.slice(1);
      const maxBytesPerChunk = 3_500_000;
      const encoder = new TextEncoder();

      const chunks: string[][][] = [];
      let current: string[][] = [header];

      for (const row of dataRows) {
        current.push(row);
        const csvText = buildCSV(current);
        if (encoder.encode(csvText).length > maxBytesPerChunk) {
          current.pop();
          if (current.length > 1) {
            chunks.push(current);
          }
          current = [header, row];
        }
      }
      if (current.length > 1) {
        chunks.push(current);
      }

      const aggregate: ImportResult = {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        invalid: 0,
        errors: [],
        existingInDb: 0,
        alreadyExisted: 0,
      };

      // Parallel chunk processing for speed
      const CONCURRENT_UPLOADS = 3;
      let completedChunks = 0;
      let hasError = false;

      const processChunk = async (chunk: string[][]): Promise<ImportResult | null> => {
        if (hasError) return null;

        const csvText = buildCSV(chunk);
        const chunkFile = new File([csvText], file.name, { type: "text/csv" });

        const formData = new FormData();
        formData.append("file", chunkFile);
        formData.append("update_existing", importSettings.updateExisting.toString());
        if (importSettings.selectedTagIds.length > 0) {
          formData.append("tag_ids", importSettings.selectedTagIds.join(","));
        }
        if (importSettings.newTagName) {
          formData.append("new_tag_name", importSettings.newTagName);
          formData.append("new_tag_color", importSettings.newTagColor);
        }
        if (importSettings.selectedListId && importSettings.selectedListId !== 'new') {
          formData.append("list_id", importSettings.selectedListId);
        }
        if (importSettings.selectedListId === 'new' && importSettings.newListName) {
          formData.append("new_list_name", importSettings.newListName);
        }

        const response = await orgFetch("/api/contacts/import", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          const detailsText = Array.isArray(data.details)
            ? data.details
                .map((d: { batch: number; message: string; details?: string }) =>
                  `batch ${d.batch}: ${d.message}${d.details ? ` (${d.details})` : ""}`
                )
                .join(" / ")
            : "";
          hasError = true;
          setError(
            `${data.error || "インポートに失敗しました"}${detailsText ? ` - ${detailsText}` : ""}`
          );
          return null;
        }

        completedChunks++;
        setProgress(Math.round((completedChunks / chunks.length) * 100));

        return data.data as ImportResult;
      };

      // Process chunks in parallel batches
      for (let i = 0; i < chunks.length; i += CONCURRENT_UPLOADS) {
        if (hasError) break;

        const parallelChunks = chunks.slice(i, i + CONCURRENT_UPLOADS);
        const results = await Promise.all(parallelChunks.map(processChunk));

        for (const chunkResult of results) {
          if (chunkResult) {
            aggregate.total += chunkResult.total;
            aggregate.created += chunkResult.created;
            aggregate.updated += chunkResult.updated;
            aggregate.skipped += chunkResult.skipped;
            aggregate.invalid += chunkResult.invalid;
            aggregate.errors = aggregate.errors.concat(chunkResult.errors || []);
            aggregate.existingInDb = Math.max(
              aggregate.existingInDb || 0,
              chunkResult.existingInDb || 0
            );
            aggregate.alreadyExisted = Math.max(
              aggregate.alreadyExisted || 0,
              chunkResult.alreadyExisted || 0
            );
          }
        }
      }

      if (hasError) {
        setImporting(false);
        return;
      }

      setResult(aggregate);
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
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
          <Progress value={progress || 10} />
          <p className="text-center text-sm text-muted-foreground">
            インポート処理中... {progress ? `${progress}%` : ""}
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

          <ImportSettings
            settings={importSettings}
            onChange={setImportSettings}
            tags={tags}
            lists={lists}
            isLoading={isSettingsLoading || importing}
          />

          <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
            <p className="font-medium mb-1">対応フォーマット:</p>
            <p className="mb-1">・標準: email, firstName, company, tags</p>
            <p className="mb-1">・HubSpot: Eメール, 名, 姓, Associated Company</p>
            <p className="mt-2 text-green-600">HubSpotからのエクスポートCSVに対応</p>
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
