import { createClient } from '@/lib/supabase/server'
import { LineSettingsClient } from '@/components/line/line-settings-client'

export default async function LineSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: accounts } = await supabase
    .from('line_accounts')
    .select('id, channel_id, bot_basic_id, display_name, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <LineSettingsClient accounts={accounts || []} />
}
