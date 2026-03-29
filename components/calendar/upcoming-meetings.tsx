'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Video,
  UserCheck,
  Loader2,
} from 'lucide-react'
import { format, isToday, isTomorrow } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { CalendarEventWithContacts } from '@/lib/types/calendar'

// ============================================
// TYPES
// ============================================

interface UpcomingMeetingsProps {
  contactId?: string
  limit?: number
}

// ============================================
// COMPONENT
// ============================================

export function UpcomingMeetings({ contactId, limit = 5 }: UpcomingMeetingsProps) {
  const [events, setEvents] = useState<CalendarEventWithContacts[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const now = new Date().toISOString()
        const params = new URLSearchParams({
          start: now,
          per_page: String(limit),
        })

        const res = await fetch(`/api/calendar/events?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          let filtered = json.data || []

          // Filter by contact if specified
          if (contactId) {
            filtered = filtered.filter(
              (e: CalendarEventWithContacts) =>
                (e.contact_ids || []).includes(contactId)
            )
          }

          setEvents(filtered.slice(0, limit))
        }
      } catch {
        // Keep empty
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [contactId, limit])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          今後のミーティング
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            予定されているミーティングはありません
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <UpcomingMeetingItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// MEETING ITEM
// ============================================

function UpcomingMeetingItem({ event }: { event: CalendarEventWithContacts }) {
  const startDate = new Date(event.start_at)

  let dateLabel: string
  if (isToday(startDate)) {
    dateLabel = '今日'
  } else if (isTomorrow(startDate)) {
    dateLabel = '明日'
  } else {
    dateLabel = format(startDate, 'M/d (E)', { locale: ja })
  }

  const timeLabel = event.is_all_day
    ? '終日'
    : format(startDate, 'HH:mm', { locale: ja })

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="flex flex-col items-center">
        <span className="text-xs font-medium text-muted-foreground">{dateLabel}</span>
        <span className="text-sm font-semibold">{timeLabel}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {event.summary || '(タイトルなし)'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {event.meet_link && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Video className="h-2.5 w-2.5" />
              オンライン
            </Badge>
          )}
          {event.matched_contacts.length > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <UserCheck className="h-2.5 w-2.5" />
              {event.matched_contacts.length}名一致
            </Badge>
          )}
          {event.attendee_emails.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {event.attendee_emails.length}名参加
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
