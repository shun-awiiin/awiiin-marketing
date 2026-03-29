/**
 * POST /api/cron/meeting-reminders
 * Cron endpoint to check and send meeting reminders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processReminders } from '@/lib/calendar/reminder-sender'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  try {
    const result = await processReminders(supabase)

    return NextResponse.json({
      message: 'Reminder processing complete',
      sent: result.sent,
      errors: result.errors,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process reminders' },
      { status: 500 }
    )
  }
}
