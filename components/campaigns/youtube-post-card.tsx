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
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Youtube, Copy, ExternalLink, CheckCircle, Loader2 } from 'lucide-react'
import {
  generateYouTubePostText,
  YOUTUBE_STUDIO_URL,
  YOUTUBE_POST_LIMITS,
  type SeminarYouTubeParams,
} from '@/lib/social/youtube-post-generator'
import type {
  TemplateType,
  SeminarInvitePayload,
  FreeTrialInvitePayload,
} from '@/lib/types/database'

interface YouTubePostCardProps {
  campaignId: string
  campaignType: TemplateType
  inputPayload: SeminarInvitePayload | FreeTrialInvitePayload
}

export function YouTubePostCard({
  campaignId,
  campaignType,
  inputPayload,
}: YouTubePostCardProps) {
  const [additionalParams, setAdditionalParams] = useState<SeminarYouTubeParams>({
    duration_minutes: 30,
    target_audience: 'eBay物販に興味がある方',
  })
  const [copied, setCopied] = useState(false)
  const [studioOpened, setStudioOpened] = useState(false)
  const [posted, setPosted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate text based on campaign type and payload
  const generatedText = useMemo(() => {
    return generateYouTubePostText(
      campaignType,
      inputPayload,
      campaignType === 'SEMINAR_INVITE' ? additionalParams : undefined
    )
  }, [campaignType, inputPayload, additionalParams])

  const characterCount = generatedText.length

  // Log event to API
  const logEvent = useCallback(
    async (eventType: 'youtube_manual_copy' | 'youtube_manual_studio_opened' | 'youtube_manual_posted') => {
      try {
        const response = await fetch('/api/social/youtube-manual-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaignId,
            campaign_type: campaignType,
            event_type: eventType,
            generated_text: generatedText,
          }),
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error)
        }
        return true
      } catch {
        return false
      }
    },
    [campaignId, campaignType, generatedText]
  )

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopied(true)
      setError(null)
      await logEvent('youtube_manual_copy')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }, [generatedText, logEvent])

  // Open YouTube Studio
  const handleOpenStudio = useCallback(async () => {
    window.open(YOUTUBE_STUDIO_URL, '_blank')
    setStudioOpened(true)
    await logEvent('youtube_manual_studio_opened')
  }, [logEvent])

  // Mark as posted
  const handlePostedChange = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        setPosted(false)
        return
      }

      setSaving(true)
      setError(null)

      const success = await logEvent('youtube_manual_posted')

      if (success) {
        setPosted(true)
      } else {
        setError('ログの保存に失敗しました')
      }

      setSaving(false)
    },
    [logEvent]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-600" />
          YouTube コミュニティ投稿
        </CardTitle>
        <CardDescription>
          キャンペーン内容からYouTubeコミュニティ投稿用のテキストを生成します。
          コピーしてYouTube Studioに貼り付けてください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seminar-specific parameters */}
        {campaignType === 'SEMINAR_INVITE' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration">セミナー時間（分）</Label>
              <Input
                id="duration"
                type="number"
                value={additionalParams.duration_minutes ?? 30}
                onChange={(e) =>
                  setAdditionalParams((prev) => ({
                    ...prev,
                    duration_minutes: parseInt(e.target.value) || 30,
                  }))
                }
                min={1}
                max={180}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">対象者（空欄で省略）</Label>
              <Input
                id="audience"
                value={additionalParams.target_audience ?? ''}
                onChange={(e) =>
                  setAdditionalParams((prev) => ({
                    ...prev,
                    target_audience: e.target.value,
                  }))
                }
                placeholder="eBay物販に興味がある方"
              />
            </div>
          </div>
        )}

        {/* Generated text preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>生成されたテキスト</Label>
            <span
              className={`text-sm ${
                characterCount > YOUTUBE_POST_LIMITS.maxCharacters
                  ? 'text-red-500'
                  : 'text-muted-foreground'
              }`}
            >
              {characterCount} / {YOUTUBE_POST_LIMITS.maxCharacters} 文字
            </span>
          </div>
          <Textarea
            value={generatedText}
            readOnly
            rows={14}
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

          <Button variant="outline" onClick={handleOpenStudio} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            YouTube Studioを開く
            {studioOpened && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </Button>
        </div>

        {/* Posted confirmation checkbox */}
        <div className="flex items-center space-x-2 pt-4 border-t">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Checkbox
              id="posted"
              checked={posted}
              onCheckedChange={handlePostedChange}
              disabled={saving}
            />
          )}
          <Label
            htmlFor="posted"
            className={`cursor-pointer ${
              posted ? 'text-green-600 font-medium' : ''
            }`}
          >
            {posted
              ? 'YouTubeに投稿しました'
              : 'YouTubeに投稿しました（チェックでログ記録）'}
          </Label>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">投稿手順</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>「テキストをコピー」をクリック</li>
            <li>「YouTube Studioを開く」をクリック</li>
            <li>コミュニティタブで投稿を作成し、テキストを貼り付け</li>
            <li>投稿後、「YouTubeに投稿しました」にチェック</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
