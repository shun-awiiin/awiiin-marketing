'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'
import type { LineAccountPublic } from '@/lib/types/l-step'

interface Props {
  onSuccess?: (account: LineAccountPublic) => void
  onError?: (error: string) => void
}

export function LineConnectForm({ onSuccess, onError }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    channel_id: '',
    channel_secret: '',
    access_token: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/line/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(true)
        setFormData({ channel_id: '', channel_secret: '', access_token: '' })
        onSuccess?.(result.data)
      } else {
        setError(result.error)
        onError?.(result.error)
      }
    } catch {
      const errorMsg = '接続に失敗しました'
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    formData.channel_id.trim() !== '' &&
    formData.channel_secret.trim() !== '' &&
    formData.access_token.trim() !== ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>LINE公式アカウントを連携</CardTitle>
        <CardDescription>
          LINE Developersコンソールから取得した情報を入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                LINEアカウントを正常に連携しました
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="channel_id">Channel ID</Label>
            <Input
              id="channel_id"
              value={formData.channel_id}
              onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
              placeholder="1234567890"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Messaging API設定のChannel ID
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel_secret">Channel Secret</Label>
            <Input
              id="channel_secret"
              type="password"
              value={formData.channel_secret}
              onChange={(e) => setFormData({ ...formData, channel_secret: e.target.value })}
              placeholder="32文字の英数字"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Basic settings &gt; Channel secret
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access_token">Channel Access Token (長期)</Label>
            <Input
              id="access_token"
              type="password"
              value={formData.access_token}
              onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
              placeholder="長いトークン文字列"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Messaging API設定 &gt; Channel access token (long-lived)
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noopener noreferrer"
              >
                LINE Developers
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>

            <Button type="submit" disabled={isLoading || !isFormValid}>
              {isLoading ? '接続中...' : '連携する'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
