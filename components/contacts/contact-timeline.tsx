'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { ActivityType, ContactActivity } from '@/lib/types/timeline'
import {
  Mail,
  Eye,
  MousePointer,
  AlertTriangle,
  FileText,
  MessageCircle,
  Tag,
  Zap,
  StickyNote,
  UserPlus,
  Loader2,
  Filter,
  CalendarCheck,
  CalendarClock,
} from 'lucide-react'

// ============================================
// ACTIVITY CONFIG
// ============================================

interface ActivityConfig {
  icon: React.ElementType
  color: string
  bgColor: string
}

const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  email_sent: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  email_opened: { icon: Eye, color: 'text-green-600', bgColor: 'bg-green-100' },
  email_clicked: { icon: MousePointer, color: 'text-green-600', bgColor: 'bg-green-100' },
  email_bounced: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
  form_submitted: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  chat_started: { icon: MessageCircle, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  chat_message: { icon: MessageCircle, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  tag_added: { icon: Tag, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  tag_removed: { icon: Tag, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  scenario_enrolled: { icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  note_added: { icon: StickyNote, color: 'text-slate-600', bgColor: 'bg-slate-100' },
  contact_created: { icon: UserPlus, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  meeting_scheduled: { icon: CalendarClock, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  meeting_completed: { icon: CalendarCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
}

// ============================================
// FILTER LABELS
// ============================================

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  email_sent: 'メール送信',
  email_opened: 'メール開封',
  email_clicked: 'メールクリック',
  email_bounced: 'バウンス',
  form_submitted: 'フォーム送信',
  chat_started: 'チャット開始',
  chat_message: 'チャットメッセージ',
  tag_added: 'タグ追加',
  tag_removed: 'タグ削除',
  scenario_enrolled: 'シナリオ登録',
  note_added: 'ノート追加',
  contact_created: 'コンタクト作成',
  meeting_scheduled: 'ミーティング予定',
  meeting_completed: 'ミーティング完了',
}

// ============================================
// COMPONENT
// ============================================

interface ContactTimelineProps {
  contactId: string
  initialActivities: ContactActivity[]
  initialHasMore: boolean
}

export function ContactTimeline({
  contactId,
  initialActivities,
  initialHasMore,
}: ContactTimelineProps) {
  const [activities, setActivities] = useState<ContactActivity[]>(initialActivities)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<ActivityType | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const fetchFiltered = useCallback(async (type: ActivityType | null) => {
    setFilterLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', per_page: '20' })
      if (type) {
        params.set('activity_type', type)
      }
      const res = await fetch(
        `/api/contacts/${contactId}/timeline?${params.toString()}`
      )
      const json = await res.json()

      if (res.ok && json.data) {
        setActivities(json.data)
        setHasMore(json.meta.has_more)
        setPage(1)
        setFilterType(type)
      }
    } catch {
      // Silently fail - activities stay as-is
    } finally {
      setFilterLoading(false)
    }
  }, [contactId])

  const loadMore = useCallback(async () => {
    setLoading(true)
    try {
      const nextPage = page + 1
      const params = new URLSearchParams({
        page: String(nextPage),
        per_page: '20',
      })
      if (filterType) {
        params.set('activity_type', filterType)
      }
      const res = await fetch(
        `/api/contacts/${contactId}/timeline?${params.toString()}`
      )
      const json = await res.json()

      if (res.ok && json.data) {
        setActivities((prev) => [...prev, ...json.data])
        setHasMore(json.meta.has_more)
        setPage(nextPage)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [contactId, page, filterType])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">タイムライン</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters((prev) => !prev)}
          className="gap-1.5"
        >
          <Filter className="h-3.5 w-3.5" />
          フィルター
        </Button>
      </CardHeader>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5 px-6 pb-3">
          <Badge
            variant={filterType === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => fetchFiltered(null)}
          >
            すべて
          </Badge>
          {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((type) => (
            <Badge
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => fetchFiltered(type)}
            >
              {ACTIVITY_TYPE_LABELS[type]}
            </Badge>
          ))}
        </div>
      )}
      <CardContent>
        {filterLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            アクティビティはまだありません
          </p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {activities.map((activity) => (
                <TimelineItem key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  読み込み中...
                </>
              ) : (
                'もっと読み込む'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// TIMELINE ITEM
// ============================================

function TimelineItem({ activity }: { activity: ContactActivity }) {
  const config = ACTIVITY_CONFIG[activity.activity_type] || ACTIVITY_CONFIG.contact_created
  const Icon = config.icon

  const relativeTime = formatDistanceToNow(new Date(activity.occurred_at), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <div className="relative flex gap-3 pl-1">
      {/* Icon */}
      <div
        className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
      >
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{activity.title}</p>
          <time className="shrink-0 text-xs text-muted-foreground" title={activity.occurred_at}>
            {relativeTime}
          </time>
        </div>
        {activity.description && (
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
            {activity.description}
          </p>
        )}
      </div>
    </div>
  )
}
