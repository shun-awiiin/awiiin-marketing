"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Link as LinkIcon,
  FileText,
  Loader2,
} from "lucide-react";

interface SpamWordMatch {
  word: string;
  category: string;
  severity: "low" | "medium" | "high";
  context: string;
}

interface LinkCheckResult {
  url: string;
  is_valid: boolean;
  is_shortened: boolean;
  domain: string;
  error?: string;
}

interface ContentCheckResult {
  overall_score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  spam_score: number;
  spam_words_found: SpamWordMatch[];
  links_found: LinkCheckResult[];
  links_valid: boolean;
  html_text_ratio: number | null;
  subject_score: number;
  subject_analysis: {
    length: number;
    has_personalization: boolean;
    has_spam_triggers: boolean;
    recommendations: string[];
  };
  recommendations: Array<{
    category: string;
    severity: "info" | "warning" | "critical";
    message: string;
    suggestion?: string;
  }>;
}

interface ContentAnalyzerProps {
  onAnalyze?: (result: ContentCheckResult) => void;
}

export function ContentAnalyzer({ onAnalyze }: ContentAnalyzerProps) {
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ContentCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!subject || !bodyText) {
      setError("件名と本文を入力してください");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/content-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body_text: bodyText,
        }),
      });

      if (!response.ok) {
        throw new Error("分析に失敗しました");
      }

      const { data } = await response.json();
      setResult(data);
      onAnalyze?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">コンテンツ分析</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subject">件名</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="メールの件名を入力"
            />
          </div>
          <div>
            <Label htmlFor="body">本文</Label>
            <Textarea
              id="body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="メールの本文を入力"
              rows={6}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            分析を実行
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Score Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl",
                    result.overall_score >= 80 && "bg-green-500",
                    result.overall_score >= 60 && result.overall_score < 80 && "bg-yellow-500",
                    result.overall_score < 60 && "bg-red-500"
                  )}
                >
                  {result.grade}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold">{result.overall_score}</span>
                    <span className="text-muted-foreground">/100</span>
                  </div>
                  <Progress value={result.overall_score} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {result.overall_score >= 80
                      ? "コンテンツは配信に適しています"
                      : result.overall_score >= 60
                      ? "いくつかの改善点があります"
                      : "配信前に改善が必要です"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spam Words */}
          {result.spam_words_found.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  検出されたスパムトリガー
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.spam_words_found.map((word, index) => (
                    <Badge
                      key={index}
                      className={cn(
                        word.severity === "high" && "bg-red-100 text-red-700",
                        word.severity === "medium" && "bg-yellow-100 text-yellow-700",
                        word.severity === "low" && "bg-gray-100 text-gray-700"
                      )}
                    >
                      {word.word}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links */}
          {result.links_found.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  リンクチェック
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.links_found.map((link, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded"
                    >
                      {link.is_valid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm truncate flex-1">{link.url}</span>
                      {link.is_shortened && (
                        <Badge variant="outline" className="text-xs">
                          短縮URL
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  改善推奨
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-lg",
                        rec.severity === "critical" && "bg-red-50",
                        rec.severity === "warning" && "bg-yellow-50",
                        rec.severity === "info" && "bg-blue-50"
                      )}
                    >
                      <p className="text-sm font-medium">{rec.message}</p>
                      {rec.suggestion && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {rec.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
