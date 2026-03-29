/**
 * POST /api/calendar/sync
 * Triggers manual calendar sync for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncCalendarEvents } from '@/lib/calendar/calendar-sync'
import { CalendarSyncQuerySchema } from '@/lib/types/calendar'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // Parse query params
  let force = false
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = CalendarSyncQuerySchema.safeParse(body)
    if (parsed.success) {
      force = parsed.data.force
    }
  } catch {
    // Use defaults
  }

  // Get calendar connection
  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    return NextResponse.json(
      { error: 'Googleカレンダーが接続されていません' },
      { status: 404 }
    )
  }

  if (!connection.sync_enabled) {
    return NextResponse.json(
      { error: '同期が無効になっています' },
      { status: 400 }
    )
  }

  try {
    const result = await syncCalendarEvents(supabase, connection, { force })

    return NextResponse.json({
      message: '同期が完了しました',
      synced: result.synced,
      matched: result.matched,
      errors: result.errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '同期に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
