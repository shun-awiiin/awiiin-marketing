/**
 * GET /api/calendar/reminders?event_id=xxx
 * List reminders for an event.
 *
 * POST /api/calendar/reminders
 * Create a new reminder.
 *
 * DELETE /api/calendar/reminders?id=xxx
 * Delete a reminder.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateReminderSchema } from '@/lib/types/calendar'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const eventId = new URL(request.url).searchParams.get('event_id')

  let query = supabase
    .from('meeting_reminders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'リマインダーの取得に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateReminderSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: '入力内容が不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Verify the event belongs to this user
  const { data: event } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('id', parsed.data.event_id)
    .eq('user_id', user.id)
    .single()

  if (!event) {
    return NextResponse.json(
      { error: 'イベントが見つかりません' },
      { status: 404 }
    )
  }

  const { data, error } = await supabase
    .from('meeting_reminders')
    .insert({
      user_id: user.id,
      event_id: parsed.data.event_id,
      remind_before_minutes: parsed.data.remind_before_minutes,
      reminder_type: parsed.data.reminder_type,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'リマインダーの作成に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const reminderId = new URL(request.url).searchParams.get('id')
  if (!reminderId) {
    return NextResponse.json(
      { error: 'リマインダーIDが必要です' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('meeting_reminders')
    .delete()
    .eq('id', reminderId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json(
      { error: 'リマインダーの削除に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: 'リマインダーを削除しました' })
}
