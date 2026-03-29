import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarSettings } from '@/components/calendar/calendar-settings'
import type { CalendarConnectionStatus } from '@/lib/types/calendar'

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Googleカレンダーへのアクセスが拒否されました',
  missing_params: 'OAuth パラメータが不足しています',
  invalid_state: 'セキュリティ検証に失敗しました。もう一度お試しください',
  no_refresh_token: 'リフレッシュトークンが取得できませんでした。もう一度お試しください',
  db_error: 'データベースへの保存に失敗しました',
  token_exchange_failed: 'トークンの取得に失敗しました',
}

const SUCCESS_MESSAGES: Record<string, string> = {
  connected: 'Googleカレンダーを接続しました',
}

export default async function CalendarSettingsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
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

  const resolvedParams = await searchParams
  const successMessage = resolvedParams.success
    ? SUCCESS_MESSAGES[resolvedParams.success] || null
    : null
  const errorMessage = resolvedParams.error
    ? ERROR_MESSAGES[resolvedParams.error] || 'エラーが発生しました'
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">カレンダー設定</h1>
        <p className="text-muted-foreground">
          Googleカレンダーの連携設定を管理します
        </p>
      </div>

      <div className="max-w-2xl">
        <CalendarSettings
          initialStatus={status}
          successMessage={successMessage}
          errorMessage={errorMessage}
        />
      </div>
    </div>
  )
}
