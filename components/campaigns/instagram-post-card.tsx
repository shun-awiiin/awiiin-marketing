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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Instagram, Copy, ExternalLink, CheckCircle, Hash } from 'lucide-react'
import {
  generateInstagramPostText,
  countHashtags,
  getDefaultHashtags,
  INSTAGRAM_WEB_URL,
  INSTAGRAM_POST_LIMITS,
  type InstagramPostParams,
} from '@/lib/social/instagram-post-generator'
import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

interface InstagramPostCardProps {
  campaignId: string
  campaignType: TemplateType
  inputPayload: SeminarInvitePayload | FreeTrialInvitePayload
}

export function InstagramPostCard({
  campaignId,
  campaignType,
  inputPayload,
}: InstagramPostCardProps) {
  const [params, setParams] = useState<InstagramPostParams>({
    target_audience: campaignType === 'SEMINAR_INVITE'
      ? '・eBay輸出に興味がある方\n・副業で収入を増やしたい方\n・物販ビジネスを始めたい方'
      : '・作業効率を上げたい方\n・時間を有効活用したい方\n・ビジネスを成長させたい方',
    content_points: '・今日から使える実践テクニック\n・よくある失敗パターンと対策\n・実際の成功事例の紹介',
    features: '・作業時間を大幅に短縮\n・面倒な作業を自動化\n・初心者でも簡単に使える',
    custom_hashtags: getDefaultHashtags(campaignType),
  })
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate post text
  const generatedText = useMemo(() => {
    return generateInstagramPostText(campaignType, inputPayload, params)
  }, [campaignType, inputPayload, params])

  const charCount = generatedText.length
  const hashtagCount = countHashtags(generatedText)
  const isOverLimit = charCount > INSTAGRAM_POST_LIMITS.maxCharacters

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

  // Open Instagram
  const handleOpenInstagram = useCallback(() => {
    window.open(INSTAGRAM_WEB_URL, '_blank')
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-pink-600" />
          Instagram 投稿
        </CardTitle>
        <CardDescription>
          キャンペーン内容からInstagram投稿用キャプションを生成します。
          ハッシュタグ付きで最適化されています。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target audience */}
        <div className="space-y-2">
          <Label htmlFor="target_audience">対象者（箇条書き）</Label>
          <Textarea
            id="target_audience"
            value={params.target_audience ?? ''}
            onChange={(e) =>
              setParams((prev) => ({
                ...prev,
                target_audience: e.target.value,
              }))
            }
            rows={3}
            placeholder="・eBay輸出に興味がある方"
          />
        </div>

        {/* Content points (seminar) or Features (free trial) */}
        {campaignType === 'SEMINAR_INVITE' ? (
          <div className="space-y-2">
            <Label htmlFor="content_points">セミナー内容（箇条書き）</Label>
            <Textarea
              id="content_points"
              value={params.content_points ?? ''}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  content_points: e.target.value,
                }))
              }
              rows={3}
              placeholder="・今日から使える実践テクニック"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="features">ツールの特徴（箇条書き）</Label>
            <Textarea
              id="features"
              value={params.features ?? ''}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  features: e.target.value,
                }))
              }
              rows={3}
              placeholder="・作業時間を大幅に短縮"
            />
          </div>
        )}

        {/* Hashtags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="hashtags">ハッシュタグ</Label>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {hashtagCount} / {INSTAGRAM_POST_LIMITS.recommendedHashtags} 推奨
            </span>
          </div>
          <Textarea
            id="hashtags"
            value={params.custom_hashtags ?? ''}
            onChange={(e) =>
              setParams((prev) => ({
                ...prev,
                custom_hashtags: e.target.value,
              }))
            }
            rows={2}
            placeholder="#eBay #物販"
          />
        </div>

        {/* Generated text preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>生成されたキャプション</Label>
            <span
              className={`text-sm font-medium ${
                isOverLimit ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              {charCount} / {INSTAGRAM_POST_LIMITS.maxCharacters} 文字
            </span>
          </div>
          <Textarea
            value={generatedText}
            readOnly
            rows={12}
            className="font-mono text-sm resize-none"
          />
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
          <Button variant="outline" onClick={handleOpenInstagram} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Instagramを開く
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">投稿手順</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>「テキストをコピー」をクリック</li>
            <li>「Instagramを開く」をクリック</li>
            <li>新規投稿を作成し、画像をアップロード</li>
            <li>キャプションにテキストを貼り付けて投稿</li>
          </ol>
          <p className="mt-2 text-xs">
            ※ Instagramは画像が必須です。投稿に合った画像を用意してください。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
