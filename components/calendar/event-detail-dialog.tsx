'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  UserCheck,
  Bell,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { CalendarEventWithContacts } from '@/lib/types/calendar'

// ============================================
// TYPES
// ============================================

interface EventDetailDialogProps {
  event: CalendarEventWithContacts | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ============================================
// COMPONENT
// ============================================

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
}: EventDetailDialogProps) {
  const [addingReminder, setAddingReminder] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState('15')
  const [reminderAdded, setReminderAdded] = useState(false)

  if (!event) return null

  const startDate = new Date(event.start_at)
  const endDate = new Date(event.end_at)

  const handleAddReminder = async () => {
    setAddingReminder(true)
    try {
      const res = await fetch('/api/calendar/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          remind_before_minutes: parseInt(reminderMinutes),
          reminder_type: 'email',
        }),
      })
      if (res.ok) {
        setReminderAdded(true)
      }
    } catch {
      // Silently fail
    } finally {
      setAddingReminder(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <span>{event.summary || '(タイトルなし)'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {event.is_all_day
                ? format(startDate, 'M月d日 (E)', { locale: ja })
                : `${format(startDate, 'M月d日 (E) HH:mm', { locale: ja })} - ${format(endDate, 'HH:mm', { locale: ja })}`}
            </span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Meet Link */}
          {event.meet_link && (
            <div className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4 text-muted-foreground" />
              <a
                href={event.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                会議に参加
              </a>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                {event.description}
              </p>
            </>
          )}

          {/* Attendees */}
          {event.attendee_emails.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  参加者 ({event.attendee_emails.length}名)
                </div>
                <div className="space-y-1">
                  {event.attendee_emails.map((email) => (
                    <div key={email} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{email}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Matched Contacts */}
          {event.matched_contacts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  一致したコンタクト
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {event.matched_contacts.map((contact) => (
                    <Badge key={contact.id} variant="secondary" className="gap-1">
                      {contact.name || contact.email}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Reminder */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Bell className="h-4 w-4" />
              リマインダー
            </div>
            {reminderAdded ? (
              <p className="text-sm text-green-600">
                リマインダーを設定しました
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={reminderMinutes}
                  onValueChange={setReminderMinutes}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5分前</SelectItem>
                    <SelectItem value="10">10分前</SelectItem>
                    <SelectItem value="15">15分前</SelectItem>
                    <SelectItem value="30">30分前</SelectItem>
                    <SelectItem value="60">1時間前</SelectItem>
                    <SelectItem value="1440">1日前</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddReminder}
                  disabled={addingReminder}
                  className="gap-1.5"
                >
                  {addingReminder ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                  設定
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
