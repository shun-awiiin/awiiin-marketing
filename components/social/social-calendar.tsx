"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns"
import { ja } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import type { SocialProvider } from "@/lib/social/types"

interface ScheduledPost {
  id: string
  title: string | null
  content: string
  scheduled_at: string
  status: string
  channels: Array<{
    id: string
    provider: SocialProvider
    status: string
  }>
}

const STATUS_COLORS = {
  scheduled: "bg-blue-500",
  published: "bg-green-500",
  failed: "bg-red-500",
  draft: "bg-gray-500",
}

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  x: "bg-black",
  instagram: "bg-gradient-to-br from-purple-600 to-pink-500",
  youtube: "bg-red-600",
  whatsapp: "bg-green-500",
}

export function SocialCalendar() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [currentMonth])

  async function fetchPosts() {
    try {
      setLoading(true)
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)

      const response = await fetch(
        `/api/social/posts?status=scheduled&limit=100`
      )
      const result = await response.json()

      if (result.success) {
        // Filter posts for current month view
        const monthPosts = result.data.filter((post: ScheduledPost) => {
          if (!post.scheduled_at) return false
          const postDate = new Date(post.scheduled_at)
          return postDate >= start && postDate <= end
        })
        setPosts(monthPosts)
      }
    } catch {
      toast.error("投稿の取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  function getPostsForDate(date: Date): ScheduledPost[] {
    return posts.filter((post) => {
      if (!post.scheduled_at) return false
      return isSameDay(new Date(post.scheduled_at), date)
    })
  }

  function handlePreviousMonth() {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  function handleNextMonth() {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  function handleDateClick(date: Date) {
    setSelectedDate(date)
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"]
  const firstDayOfMonth = startOfMonth(currentMonth).getDay()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>投稿カレンダー</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentMonth, "yyyy年M月", { locale: ja })}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              今日
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Week day headers */}
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={`p-2 text-center text-sm font-medium ${
                  i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""
                }`}
              >
                {day}
              </div>
            ))}

            {/* Empty cells for days before the first of the month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] p-1" />
            ))}

            {/* Calendar days */}
            {days.map((day) => {
              const dayPosts = getPostsForDate(day)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const dayOfWeek = day.getDay()

              return (
                <Popover key={day.toISOString()}>
                  <PopoverTrigger asChild>
                    <button
                      className={`min-h-[100px] p-1 text-left border rounded-lg transition-colors hover:bg-muted/50 ${
                        isToday ? "border-primary bg-primary/5" : ""
                      } ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => handleDateClick(day)}
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${
                          dayOfWeek === 0
                            ? "text-red-500"
                            : dayOfWeek === 6
                            ? "text-blue-500"
                            : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map((post) => (
                          <div
                            key={post.id}
                            className={`text-xs p-1 rounded truncate text-white ${
                              STATUS_COLORS[post.status as keyof typeof STATUS_COLORS] || "bg-gray-500"
                            }`}
                          >
                            {format(new Date(post.scheduled_at), "HH:mm")}{" "}
                            {post.title || post.content.slice(0, 20)}
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayPosts.length - 3}件
                          </div>
                        )}
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">
                          {format(day, "M月d日(E)", { locale: ja })}
                        </h4>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/dashboard/social/posts/new?date=${format(day, "yyyy-MM-dd")}`)}
                        >
                          <Plus className="size-3 mr-1" />
                          追加
                        </Button>
                      </div>
                      {dayPosts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          予約投稿はありません
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {dayPosts.map((post) => (
                            <div
                              key={post.id}
                              className="p-2 border rounded-lg cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/dashboard/social/posts/${post.id}`)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="size-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {format(new Date(post.scheduled_at), "HH:mm")}
                                </span>
                                {post.status === "published" && (
                                  <CheckCircle2 className="size-3 text-green-500" />
                                )}
                                {post.status === "failed" && (
                                  <AlertCircle className="size-3 text-red-500" />
                                )}
                              </div>
                              <p className="text-sm line-clamp-2">
                                {post.title || post.content}
                              </p>
                              <div className="flex gap-1 mt-2">
                                {post.channels?.map((ch) => (
                                  <div
                                    key={ch.id}
                                    className={`size-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                                      PROVIDER_COLORS[ch.provider]
                                    }`}
                                  >
                                    {ch.provider === "x" ? "X" :
                                     ch.provider === "instagram" ? "IG" :
                                     ch.provider === "youtube" ? "YT" : "WA"}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
