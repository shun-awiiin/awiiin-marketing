/**
 * POST /api/cron/calendar-sync
 * Cron endpoint for periodic calendar sync (every 15 minutes).
 * Syncs all enabled calendar connections.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncCalendarEvents } from '@/lib/calendar/calendar-sync'
import type { CalendarConnection } from '@/lib/types/calendar'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Get all enabled connections
  const { data: connections, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('sync_enabled', true)

  if (error || !connections) {
    return NextResponse.json(
      { error: 'Failed to fetch connections', details: error?.message },
      { status: 500 }
    )
  }

  const results = []

  for (const connection of connections as CalendarConnection[]) {
    try {
      const result = await syncCalendarEvents(supabase, connection)
      results.push({
        user_id: connection.user_id,
        synced: result.synced,
        matched: result.matched,
        errors: result.errors,
      })
    } catch (err) {
      results.push({
        user_id: connection.user_id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    processed: connections.length,
    results,
  })
}
