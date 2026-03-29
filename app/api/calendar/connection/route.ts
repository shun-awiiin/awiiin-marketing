/**
 * GET /api/calendar/connection
 * Returns current calendar connection status.
 *
 * DELETE /api/calendar/connection
 * Disconnects the Google Calendar integration.
 *
 * PATCH /api/calendar/connection
 * Updates sync settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CalendarSettingsSchema } from '@/lib/types/calendar'
import type { CalendarConnectionStatus } from '@/lib/types/calendar'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('google_email, sync_enabled, last_synced_at, calendar_id')
    .eq('user_id', user.id)
    .single()

  const status: CalendarConnectionStatus = {
    connected: !!connection,
    google_email: connection?.google_email || null,
    sync_enabled: connection?.sync_enabled || false,
    last_synced_at: connection?.last_synced_at || null,
    calendar_id: connection?.calendar_id || 'primary',
  }

  return NextResponse.json(status)
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json(
      { error: '接続の解除に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: 'Googleカレンダーの接続を解除しました' })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CalendarSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: '入力内容が不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('calendar_connections')
    .update({
      sync_enabled: parsed.data.sync_enabled,
      calendar_id: parsed.data.calendar_id,
    })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json(
      { error: '設定の更新に失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: '設定を更新しました' })
}
