import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarView } from '@/components/calendar/calendar-view'
import { UpcomingMeetings } from '@/components/calendar/upcoming-meetings'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if calendar is connected
  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('id, sync_enabled')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    redirect('/dashboard/calendar/settings')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">カレンダー</h1>
        <p className="text-muted-foreground">
          Googleカレンダーと同期されたミーティング情報を確認できます
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <CalendarView />
        <div className="space-y-6">
          <UpcomingMeetings limit={8} />
        </div>
      </div>
    </div>
  )
}
