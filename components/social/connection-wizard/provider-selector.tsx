"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import type { SocialProvider } from "@/lib/social/types"

interface ProviderSelectorProps {
  connectedProviders?: SocialProvider[]
  onSelect?: (provider: SocialProvider) => void
}

interface ProviderConfig {
  id: SocialProvider
  name: string
  description: string
  icon: string
  color: string
  features: string[]
  available: boolean
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "x",
    name: "X (Twitter)",
    description: "ツイート、リプライ、スレッドを投稿",
    icon: "X",
    color: "bg-black",
    features: ["ツイート投稿", "画像/動画添付", "スレッド投稿", "投票作成"],
    available: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "フィード投稿、リール、カルーセル",
    icon: "IG",
    color: "bg-gradient-to-br from-purple-600 to-pink-500",
    features: ["フィード投稿", "リール", "カルーセル", "ストーリー"],
    available: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "動画アップロード、ショート",
    icon: "YT",
    color: "bg-red-600",
    features: ["動画アップロード", "ショート", "コミュニティ投稿"],
    available: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "テンプレートメッセージ配信",
    icon: "WA",
    color: "bg-green-500",
    features: ["テンプレート配信", "通知送信"],
    available: true,
  },
]

export function ProviderSelector({ connectedProviders = [], onSelect }: ProviderSelectorProps) {
  const [connecting, setConnecting] = useState<SocialProvider | null>(null)

  async function handleConnect(provider: SocialProvider) {
    try {
      setConnecting(provider)

      const response = await fetch("/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: provider }),
      })

      const result = await response.json()

      if (result.success && result.data.authorizationUrl) {
        if (onSelect) {
          onSelect(provider)
        }
        window.location.href = result.data.authorizationUrl
      } else {
        toast.error(result.error || "接続の開始に失敗しました")
        setConnecting(null)
      }
    } catch {
      toast.error("接続の開始に失敗しました")
      setConnecting(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PROVIDERS.map((provider) => {
        const isConnected = connectedProviders.includes(provider.id)
        const isConnecting = connecting === provider.id

        return (
          <Card
            key={provider.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isConnected ? "border-green-500/50 bg-green-50/30" : ""
            } ${!provider.available ? "opacity-60" : ""}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-12 items-center justify-center rounded-full text-white ${provider.color}`}
                  >
                    <span className="text-lg font-bold">{provider.icon}</span>
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {provider.name}
                      {isConnected && (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          <Check className="mr-1 size-3" />
                          接続済み
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{provider.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="text-sm text-muted-foreground mb-2">機能:</div>
                <div className="flex flex-wrap gap-1">
                  {provider.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!provider.available || isConnecting}
                variant={isConnected ? "outline" : "default"}
                onClick={() => handleConnect(provider.id)}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    接続中...
                  </>
                ) : isConnected ? (
                  <>
                    再接続
                    <ChevronRight className="ml-2 size-4" />
                  </>
                ) : (
                  <>
                    接続する
                    <ChevronRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
