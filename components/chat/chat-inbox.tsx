"use client"

import { useState, useEffect, useCallback } from "react"
import { Send, CheckCircle, XCircle, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { ChatConversationList } from "./chat-conversation-list"
import { ChatMessageThread } from "./chat-message-thread"
import type { ChatMessage, ConversationStatus } from "@/lib/types/chat"
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

interface ConversationWithMeta {
  id: string
  widget_id: string
  visitor_id: string
  status: ConversationStatus
  created_at: string
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
  unread_count?: number
}

interface ChatInboxProps {
  initialConversations: Array<Record<string, unknown>>
  userId: string
}

export function ChatInbox({ initialConversations, userId }: ChatInboxProps) {
  const orgFetch = useOrgFetch();
  const [conversations, setConversations] = useState<ConversationWithMeta[]>(
    initialConversations as unknown as ConversationWithMeta[]
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [sending, setSending] = useState(false)

  const selectedConversation = conversations.find((c) => c.id === selectedId)

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true)
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages`
      )
      if (res.ok) {
        const json = await res.json()
        setMessages(json.data ?? [])
      }
    } catch {
      // Network error - messages stay empty
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      setInputValue("")
      loadMessages(id)
    },
    [loadMessages]
  )

  const handleSend = useCallback(async () => {
    if (!selectedId || !inputValue.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(
        `/api/chat/conversations/${selectedId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: inputValue.trim() }),
        }
      )
      if (res.ok) {
        const json = await res.json()
        const newMsg = json.data as ChatMessage
        setMessages((prev) => [...prev, newMsg])
        setInputValue("")

        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? {
                  ...c,
                  last_message: {
                    id: newMsg.id,
                    content: newMsg.content,
                    role: newMsg.role,
                    created_at: newMsg.created_at,
                  },
                }
              : c
          )
        )
      }
    } catch {
      // Network error
    } finally {
      setSending(false)
    }
  }, [selectedId, inputValue, sending])

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!selectedId) return
      try {
        const res = await orgFetch(`/api/chat/conversations/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
        if (res.ok) {
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedId ? { ...c, status } : c))
          )
        }
      } catch {
        // Network error
      }
    },
    [selectedId]
  )

  const handleDelete = useCallback(async () => {
    if (!selectedId) return
    if (!window.confirm("この会話を削除しますか？この操作は取り消せません。")) return
    try {
      const res = await orgFetch(`/api/chat/conversations/${selectedId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== selectedId))
        setSelectedId(null)
        setMessages([])
      }
    } catch {
      // Network error
    }
  }, [selectedId])

  // Supabase realtime subscription for new messages
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("chat-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage

          // Update messages if this conversation is selected
          if (newMsg.conversation_id === selectedId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          }

          // Update conversation list with latest message
          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversation_id
                ? {
                    ...c,
                    last_message: {
                      id: newMsg.id,
                      content: newMsg.content,
                      role: newMsg.role,
                      created_at: newMsg.created_at,
                    },
                    unread_count:
                      newMsg.conversation_id !== selectedId &&
                      newMsg.role === "visitor"
                        ? (c.unread_count ?? 0) + 1
                        : c.unread_count,
                  }
                : c
            )
          )
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_conversations",
        },
        (payload) => {
          const newConv = payload.new as ConversationWithMeta
          setConversations((prev) => {
            if (prev.some((c) => c.id === newConv.id)) return prev
            return [{ ...newConv, last_message: null }, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedId, userId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full rounded-lg border bg-background overflow-hidden">
      {/* Left: Conversation List */}
      <div className="w-80 flex-shrink-0">
        <ChatConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Right: Message Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-sm font-medium truncate">
                  {selectedConversation.visitor?.name ??
                    selectedConversation.visitor?.email ??
                    `訪問者 #${selectedConversation.visitor_id.slice(0, 6)}`}
                </h3>
                <Badge variant="outline" className="text-xs capitalize">
                  {selectedConversation.status === "open" && "未対応"}
                  {selectedConversation.status === "assigned" && "対応中"}
                  {selectedConversation.status === "resolved" && "解決済み"}
                  {selectedConversation.status === "closed" && "クローズ"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      ステータス変更
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStatusChange("open")}>
                      未対応に戻す
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("resolved")}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      解決済みにする
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("closed")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      クローズする
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ChatMessageThread
              messages={messages}
              isLoading={messagesLoading}
            />

            {/* Input */}
            {selectedConversation.status !== "closed" && (
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="メッセージを入力...（Shift+Enterで改行）"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sending}
                    size="icon"
                    className="h-auto"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12" />
            <p className="text-sm">会話を選択してください</p>
          </div>
        )}
      </div>
    </div>
  )
}
