"use client"

import { useState, useMemo } from "react"
import { Search, Circle, CheckCircle, XCircle, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ConversationStatus } from "@/lib/types/chat"

interface ConversationItem {
  id: string
  status: ConversationStatus
  visitor?: {
    id: string
    name: string | null
    email: string | null
  } | null
  last_message?: {
    id: string
    content: string
    role: string
    created_at: string
  } | null
  created_at: string
  unread_count?: number
}

interface ChatConversationListProps {
  conversations: ConversationItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_FILTERS: { value: ConversationStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "open", label: "未対応" },
  { value: "assigned", label: "対応中" },
  { value: "resolved", label: "解決済み" },
  { value: "closed", label: "クローズ" },
]

function getStatusIcon(status: ConversationStatus) {
  switch (status) {
    case "open":
      return <Circle className="h-3 w-3 text-orange-500 fill-orange-500" />
    case "assigned":
      return <Clock className="h-3 w-3 text-blue-500" />
    case "resolved":
      return <CheckCircle className="h-3 w-3 text-green-500" />
    case "closed":
      return <XCircle className="h-3 w-3 text-muted-foreground" />
  }
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "たった今"
  if (diffMin < 60) return `${diffMin}分前`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}時間前`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}日前`

  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
}

function getVisitorLabel(visitor: ConversationItem["visitor"]): string {
  if (!visitor) return "不明な訪問者"
  if (visitor.name) return visitor.name
  if (visitor.email) return visitor.email
  return `訪問者 #${visitor.id.slice(0, 6)}`
}

export function ChatConversationList({
  conversations,
  selectedId,
  onSelect,
}: ChatConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all")

  const filtered = useMemo(() => {
    return conversations.filter((conv) => {
      if (statusFilter !== "all" && conv.status !== statusFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const visitorName = conv.visitor?.name?.toLowerCase() ?? ""
        const visitorEmail = conv.visitor?.email?.toLowerCase() ?? ""
        const lastMsg = conv.last_message?.content?.toLowerCase() ?? ""
        if (
          !visitorName.includes(q) &&
          !visitorEmail.includes(q) &&
          !lastMsg.includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [conversations, statusFilter, searchQuery])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: conversations.length }
    for (const conv of conversations) {
      counts[conv.status] = (counts[conv.status] || 0) + 1
    }
    return counts
  }, [conversations])

  return (
    <div className="flex h-full flex-col border-r">
      <div className="border-b p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="会話を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full border transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-accent"
              )}
            >
              {f.label}
              {(statusCounts[f.value] ?? 0) > 0 && (
                <span className="ml-1">({statusCounts[f.value]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            会話が見つかりません
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full text-left p-3 hover:bg-accent/50 transition-colors",
                  selectedId === conv.id && "bg-accent"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(conv.status)}
                    <span className="text-sm font-medium truncate">
                      {getVisitorLabel(conv.visitor)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(conv.last_message?.created_at ?? conv.created_at)}
                  </span>
                </div>
                {conv.last_message && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 pl-5">
                    {conv.last_message.role === "agent" && (
                      <span className="font-medium">あなた: </span>
                    )}
                    {conv.last_message.content}
                  </p>
                )}
                {(conv.unread_count ?? 0) > 0 && (
                  <Badge variant="default" className="mt-1 ml-5 text-xs">
                    {conv.unread_count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
