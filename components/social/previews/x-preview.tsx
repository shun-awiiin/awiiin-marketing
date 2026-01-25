"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, MessageCircle, Repeat2, Share, BarChart2 } from "lucide-react"

interface XPreviewProps {
  content: string
  displayName?: string
  username?: string
  profileImageUrl?: string
  mediaUrls?: string[]
}

const MAX_CHARS = 280

export function XPreview({
  content,
  displayName = "ユーザー名",
  username = "username",
  profileImageUrl,
  mediaUrls = [],
}: XPreviewProps) {
  // Calculate character count (URLs count as 23 chars)
  const urlRegex = /https?:\/\/[^\s]+/g
  const urls = content.match(urlRegex) || []
  let charCount = content.length

  for (const url of urls) {
    charCount = charCount - url.length + 23
  }

  const isOverLimit = charCount > MAX_CHARS
  const charCountColor = isOverLimit
    ? "text-destructive"
    : charCount > MAX_CHARS - 20
    ? "text-yellow-600"
    : "text-muted-foreground"

  // Format content with links and hashtags highlighted
  const formattedContent = content
    .split(/(\s+)/)
    .map((part, i) => {
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <span key={i} className="text-blue-500">
            {part.length > 30 ? part.substring(0, 30) + "..." : part}
          </span>
        )
      }
      if (part.startsWith("#")) {
        return (
          <span key={i} className="text-blue-500">
            {part}
          </span>
        )
      }
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-blue-500">
            {part}
          </span>
        )
      }
      return part
    })

  return (
    <Card className="max-w-[500px] bg-black text-white border-zinc-800">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex gap-3">
          <Avatar className="size-10">
            {profileImageUrl ? (
              <AvatarImage src={profileImageUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-zinc-700">
              {displayName[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">{displayName}</span>
              <span className="text-zinc-500">@{username}</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">今</span>
            </div>

            {/* Content */}
            <div className="mt-1 whitespace-pre-wrap break-words text-[15px]">
              {formattedContent}
            </div>

            {/* Media Preview */}
            {mediaUrls.length > 0 && (
              <div className={`mt-3 grid gap-1 rounded-2xl overflow-hidden ${
                mediaUrls.length === 1
                  ? "grid-cols-1"
                  : mediaUrls.length === 2
                  ? "grid-cols-2"
                  : mediaUrls.length === 3
                  ? "grid-cols-2"
                  : "grid-cols-2"
              }`}>
                {mediaUrls.slice(0, 4).map((url, i) => (
                  <div
                    key={i}
                    className={`bg-zinc-800 ${
                      mediaUrls.length === 3 && i === 0 ? "row-span-2" : ""
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{
                        aspectRatio: mediaUrls.length === 1 ? "16/9" : "1/1",
                        maxHeight: "300px",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex justify-between text-zinc-500 max-w-[400px]">
              <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                <MessageCircle className="size-4" />
                <span className="text-xs">0</span>
              </button>
              <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
                <Repeat2 className="size-4" />
                <span className="text-xs">0</span>
              </button>
              <button className="flex items-center gap-1 hover:text-pink-500 transition-colors">
                <Heart className="size-4" />
                <span className="text-xs">0</span>
              </button>
              <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                <BarChart2 className="size-4" />
                <span className="text-xs">0</span>
              </button>
              <button className="hover:text-blue-500 transition-colors">
                <Share className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Character Count */}
        <div className={`mt-3 text-right text-sm ${charCountColor}`}>
          {charCount} / {MAX_CHARS}
          {isOverLimit && (
            <span className="ml-2 text-destructive">
              ({charCount - MAX_CHARS}文字オーバー)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
