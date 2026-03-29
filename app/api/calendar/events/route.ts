/**
 * GET /api/calendar/events
 * List synced calendar events for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CalendarEventsQuerySchema } from '@/lib/types/calendar'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = CalendarEventsQuerySchema.safeParse(
    Object.fromEntries(searchParams)
  )

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'パラメータが不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { start, end, page, per_page } = parsed.data
  const offset = (page - 1) * per_page

  let query = supabase
    .from('calendar_events')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true })

  if (start) {
    query = query.gte('start_at', start)
  }
  if (end) {
    query = query.lte('start_at', end)
  }

  query = query.range(offset, offset + per_page - 1)

  const { data: events, count, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'イベントの取得に失敗しました' },
      { status: 500 }
    )
  }

  // Fetch matched contacts for all events
  const allContactIds = Array.from(
    new Set(
      (events || []).flatMap((e) => (e.contact_ids as string[]) || [])
    )
  )

  let contactMap: Record<string, { id: string; email: string; name: string | null }> = {}

  if (allContactIds.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, first_name')
      .in('id', allContactIds)

    if (contacts) {
      contactMap = Object.fromEntries(
        contacts.map((c) => [
          c.id,
          {
            id: c.id,
            email: c.email,
            name: c.first_name || null,
          },
        ])
      )
    }
  }

  const eventsWithContacts = (events || []).map((event) => ({
    ...event,
    matched_contacts: ((event.contact_ids as string[]) || [])
      .map((id) => contactMap[id])
      .filter(Boolean),
  }))

  return NextResponse.json({
    data: eventsWithContacts,
    meta: {
      total: count || 0,
      page,
      per_page,
      has_more: (count || 0) > offset + per_page,
    },
  })
}
