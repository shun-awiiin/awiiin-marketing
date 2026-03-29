"use client"

import { useEffect, useRef } from "react"
import { User, Headphones } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types/chat"

interface ChatMessageThreadProps {
  messages: ChatMessage[]
  isLoading?: boolean
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return "今日"
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "昨日"
  }
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function shouldShowDateSeparator(
  current: ChatMessage,
  previous: ChatMessage | undefined
): boolean {
  if (!previous) return true
  const currentDate = new Date(current.created_at).toDateString()
  const previousDate = new Date(previous.created_at).toDateString()
  return currentDate !== previousDate
}

export function ChatMessageThread({
  messages,
  isLoading = false,
}: ChatMessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">
          メッセージを読み込み中...
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          メッセージはまだありません
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4 max-w-2xl mx-auto">
        {messages.map((msg, idx) => {
          const showDate = shouldShowDateSeparator(msg, messages[idx - 1])
          const isVisitor = msg.role === "visitor"
          const isSystem = msg.role === "system"

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatMessageDate(msg.created_at)}
                  </span>
                </div>
              )}

              {isSystem ? (
                <div className="flex justify-center my-2">
                  <span className="text-xs text-muted-foreground italic">
                    {msg.content}
                  </span>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex gap-2",
                    isVisitor ? "justify-start" : "justify-end"
                  )}
                >
                  {isVisitor && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2",
                      isVisitor
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {msg.metadata?.image_url ? (
                      <a
                        href={msg.metadata.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={msg.metadata.image_url}
                          alt="Attachment"
                          className="max-w-full max-h-60 rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        isVisitor
                          ? "text-muted-foreground"
                          : "text-primary-foreground/70"
                      )}
                    >
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                  {!isVisitor && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Headphones className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
