"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react"
import { ProviderSelector } from "./provider-selector"
import type { SocialProvider } from "@/lib/social/types"

const PROVIDER_NAMES: Record<SocialProvider, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  youtube: "YouTube",
  whatsapp: "WhatsApp Business",
}

interface ConnectionWizardProps {
  onBack?: () => void
}

export function ConnectionWizard({ onBack }: ConnectionWizardProps) {
  const searchParams = useSearchParams()
  const [connectedProviders, setConnectedProviders] = useState<SocialProvider[]>([])
  const [showSuccess, setShowSuccess] = useState<SocialProvider | null>(null)
  const [showError, setShowError] = useState<string | null>(null)

  useEffect(() => {
    // Check for success/error from OAuth callback
    const connected = searchParams.get("connected") as SocialProvider | null
    const error = searchParams.get("error")

    if (connected && PROVIDER_NAMES[connected]) {
      setShowSuccess(connected)
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname)
    }

    if (error) {
      setShowError(decodeURIComponent(error))
      window.history.replaceState({}, "", window.location.pathname)
    }

    // Fetch existing connections
    fetchConnections()
  }, [searchParams])

  async function fetchConnections() {
    try {
      const response = await fetch("/api/social/accounts")
      const result = await response.json()

      if (result.success) {
        const providers = result.data.map((a: { provider: SocialProvider }) => a.provider)
        setConnectedProviders([...new Set(providers)] as SocialProvider[])
      }
    } catch {
      // Ignore errors silently
    }
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" />
          戻る
        </Button>
      )}

      {showSuccess && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="size-4 text-green-600" />
          <AlertTitle className="text-green-800">接続完了</AlertTitle>
          <AlertDescription className="text-green-700">
            {PROVIDER_NAMES[showSuccess]}アカウントが正常に接続されました。
            投稿のスケジュールと自動配信ができるようになりました。
          </AlertDescription>
        </Alert>
      )}

      {showError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>接続エラー</AlertTitle>
          <AlertDescription>{showError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>SNSアカウントを接続</CardTitle>
          <CardDescription>
            投稿を配信したいSNSプラットフォームを選択して接続してください。
            接続すると、投稿のスケジュールと自動配信ができるようになります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProviderSelector
            connectedProviders={connectedProviders}
            onSelect={() => {
              setShowSuccess(null)
              setShowError(null)
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OAuth認証について</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            各プラットフォームへの接続には、OAuth認証を使用します。
            これにより、パスワードを共有することなく安全にアクセス権限を付与できます。
          </p>
          <p>
            付与された権限は、投稿の作成と公開のみに使用されます。
            いつでもアカウント設定から接続を解除できます。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export { ProviderSelector }
