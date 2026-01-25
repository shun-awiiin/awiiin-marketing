'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Twitter, Copy, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  generateXPostText,
  calculateXCharCount,
  X_WEB_URL,
  X_POST_LIMITS,
  type XPostParams,
} from '@/lib/social/x-post-generator'
import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

interface XPostCardProps {
  campaignId: string
  campaignType: TemplateType
  inputPayload: SeminarInvitePayload | FreeTrialInvitePayload
}

export function XPostCard({
  campaignId,
  campaignType,
  inputPayload,
}: XPostCardProps) {
  const [params, setParams] = useState<XPostParams>({
    benefits: '実践ノウハウを共有します',
  })
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate post text
  const generatedText = useMemo(() => {
    return generateXPostText(campaignType, inputPayload, params)
  }, [campaignType, inputPayload, params])

  const charCount = calculateXCharCount(generatedText)
  const isOverLimit = charCount > X_POST_LIMITS.maxCharacters

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopied(true)
      setError(null)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }, [generatedText])

  // Open X compose
  const handleOpenX = useCallback(() => {
    // Use X intent URL with pre-filled text
    const encodedText = encodeURIComponent(generatedText)
    window.open(`https://x.com/intent/tweet?text=${encodedText}`, '_blank')
  }, [generatedText])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          X (Twitter) 投稿
        </CardTitle>
        <CardDescription>
          キャンペーン内容からツイート用テキストを生成します。
          280文字以内に収まるよう最適化されています。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seminar-specific parameters */}
        {campaignType === 'SEMINAR_INVITE' && (
          <div className="space-y-2">
            <Label htmlFor="benefits">アピールポイント（短く）</Label>
            <Input
              id="benefits"
              value={params.benefits ?? ''}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  benefits: e.target.value,
                }))
              }
              placeholder="実践ノウハウを共有します"
              maxLength={50}
            />
          </div>
        )}

        {/* Generated text preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>生成されたツイート</Label>
            <span
              className={`text-sm font-medium ${
                isOverLimit ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              {charCount} / {X_POST_LIMITS.maxCharacters} 文字
            </span>
          </div>
          <Textarea
            value={generatedText}
            readOnly
            rows={8}
            className="font-mono text-sm resize-none"
          />
          {isOverLimit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                文字数制限を超えています。テキストを短くしてください。
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={copied ? 'default' : 'outline'}
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4" />
                コピーしました
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                テキストをコピー
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenX}
            className="gap-2"
            disabled={isOverLimit}
          >
            <ExternalLink className="h-4 w-4" />
            Xで投稿する
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">投稿手順</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>「Xで投稿する」をクリック（テキストが自動入力されます）</li>
            <li>必要に応じて画像を追加</li>
            <li>「ポストする」をクリック</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
