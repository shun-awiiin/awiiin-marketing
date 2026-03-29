'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Video,
  UserCheck,
  RefreshCw,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { EventDetailDialog } from './event-detail-dialog'
import type { CalendarEventWithContacts } from '@/lib/types/calendar'
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

// ============================================
// TYPES
// ============================================

type ViewMode = 'month' | 'week'

// ============================================
// COMPONENT
// ============================================

export function CalendarView() {
  const orgFetch = useOrgFetch();
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEventWithContacts[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithContacts | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

      const params = new URLSearchParams({
        start: calStart.toISOString(),
        end: calEnd.toISOString(),
        per_page: '100',
      })

      const res = await orgFetch(`/api/calendar/events?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setEvents(json.data || [])
      }
    } catch {
      // Keep empty
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await orgFetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })
      await fetchEvents()
    } catch {
      // Silently fail
    } finally {
      setSyncing(false)
    }
  }

  const handlePrev = () => setCurrentDate((d) => subMonths(d, 1))
  const handleNext = () => setCurrentDate((d) => addMonths(d, 1))
  const handleToday = () => setCurrentDate(new Date())

  const handleEventClick = (event: CalendarEventWithContacts) => {
    setSelectedEvent(event)
    setDialogOpen(true)
  }

  // Build calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const getEventsForDay = (date: Date) =>
    events.filter((e) => isSameDay(new Date(e.start_at), date))

  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            カレンダー
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="gap-1.5"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              同期
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleToday}>
                今日
              </Button>
            </div>
            <h2 className="text-lg font-semibold">
              {format(currentDate, 'yyyy年M月', { locale: ja })}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                月
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                週
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {/* Header */}
              <div className="grid grid-cols-7 border-b bg-muted/50">
                {weekDays.map((dayName) => (
                  <div
                    key={dayName}
                    className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7">
                  {week.map((date) => {
                    const dayEvents = getEventsForDay(date)
                    const isCurrentMonth = isSameMonth(date, currentDate)
                    const isCurrentDay = isToday(date)

                    return (
                      <div
                        key={date.toISOString()}
                        className={`min-h-[80px] border-b border-r p-1 ${
                          !isCurrentMonth ? 'bg-muted/30' : ''
                        }`}
                      >
                        <div className="flex justify-end">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                              isCurrentDay
                                ? 'bg-indigo-600 font-bold text-white'
                                : isCurrentMonth
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {format(date, 'd')}
                          </span>
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              onClick={() => handleEventClick(event)}
                              className={`w-full truncate rounded px-1 py-0.5 text-left text-xs ${
                                event.matched_contacts.length > 0
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                              }`}
                            >
                              {event.summary || '(タイトルなし)'}
                            </button>
                          ))}
                          {dayEvents.length > 3 && (
                            <p className="px-1 text-xs text-muted-foreground">
                              +{dayEvents.length - 3}件
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EventDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
