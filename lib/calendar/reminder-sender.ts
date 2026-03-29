/**
 * Meeting Reminder Sender
 * Checks upcoming meetings and sends reminder emails via existing SES infra.
 */

import { sendEmail } from '@/lib/email/email-sender'
import type { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface PendingReminder {
  id: string
  user_id: string
  event_id: string
  remind_before_minutes: number
  reminder_type: 'email' | 'notification'
  event: {
    summary: string | null
    start_at: string
    end_at: string
    meet_link: string | null
    location: string | null
    attendee_emails: string[]
  }
  user: {
    email: string
    display_name: string | null
  }
}

export interface ReminderSendResult {
  sent: number
  errors: number
}

/**
 * Find and send all pending reminders that are due.
 */
export async function processReminders(
  supabase: SupabaseClient
): Promise<ReminderSendResult> {
  const result: ReminderSendResult = { sent: 0, errors: 0 }

  // Fetch unsent reminders with their events
  const { data: reminders, error: fetchError } = await supabase
    .from('meeting_reminders')
    .select(`
      id,
      user_id,
      event_id,
      remind_before_minutes,
      reminder_type,
      calendar_events!inner (
        summary,
        start_at,
        end_at,
        meet_link,
        location,
        attendee_emails,
        status
      )
    `)
    .is('sent_at', null)
    .eq('calendar_events.status', 'confirmed')

  if (fetchError || !reminders) {
    return result
  }

  const now = new Date()

  for (const reminder of reminders) {
    const event = (reminder as Record<string, unknown>).calendar_events as {
      summary: string | null
      start_at: string
      end_at: string
      meet_link: string | null
      location: string | null
      attendee_emails: string[]
      status: string
    }

    if (!event) continue

    const eventStart = new Date(event.start_at)
    const reminderTime = new Date(
      eventStart.getTime() - reminder.remind_before_minutes * 60 * 1000
    )

    // Check if it's time to send (within the last 5 minutes)
    if (now < reminderTime || now.getTime() - reminderTime.getTime() > 5 * 60 * 1000) {
      continue
    }

    // Only send email reminders for now
    if (reminder.reminder_type !== 'email') {
      continue
    }

    // Get user email
    const { data: userData } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', reminder.user_id)
      .single()

    if (!userData) continue

    try {
      const formattedStart = format(eventStart, 'M/d (E) HH:mm', { locale: ja })
      const subject = `[リマインダー] ${event.summary || 'ミーティング'} - ${formattedStart}`

      let body = `${userData.display_name || 'ユーザー'}さん\n\n`
      body += `まもなくミーティングが始まります。\n\n`
      body += `件名: ${event.summary || '(タイトルなし)'}\n`
      body += `開始: ${formattedStart}\n`

      if (event.location) {
        body += `場所: ${event.location}\n`
      }
      if (event.meet_link) {
        body += `会議リンク: ${event.meet_link}\n`
      }
      if (event.attendee_emails.length > 0) {
        body += `参加者: ${event.attendee_emails.join(', ')}\n`
      }

      body += '\n---\nAwiiin Marketing'

      const sendResult = await sendEmail({
        to: userData.email,
        subject,
        text: body,
        fromName: 'Awiiin Marketing',
        fromEmail: process.env.REMINDER_FROM_EMAIL || 'noreply@awiiin.com',
      })

      if (sendResult.success) {
        await supabase
          .from('meeting_reminders')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', reminder.id)
        result.sent++
      } else {
        result.errors++
      }
    } catch {
      result.errors++
    }
  }

  return result
}
