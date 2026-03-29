"use client"

import { useState, useCallback } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChatWidgetSettings } from "./chat-widget-settings"
import type { ChatWidget } from "@/lib/types/chat"
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

interface ChatSettingsPageProps {
  initialWidgets: ChatWidget[]
}

export function ChatSettingsPage({ initialWidgets }: ChatSettingsPageProps) {
  const orgFetch = useOrgFetch();
  const [widgets, setWidgets] = useState<ChatWidget[]>(initialWidgets)

  const handleRefresh = useCallback(async () => {
    try {
      const res = await orgFetch("/api/chat/widgets")
      if (res.ok) {
        const json = await res.json()
        setWidgets(json.data ?? [])
      }
    } catch {
      // Network error
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/chat">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            チャットウィジェット設定
          </h1>
          <p className="text-muted-foreground text-sm">
            ウィジェットの作成・管理・埋め込みコードの取得
          </p>
        </div>
      </div>

      <ChatWidgetSettings widgets={widgets} onRefresh={handleRefresh} />
    </div>
  )
}
