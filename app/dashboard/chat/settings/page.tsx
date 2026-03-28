import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatSettingsPage } from '@/components/chat/chat-settings-page'

export default async function ChatSettingsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: widgets } = await supabase
    .from('chat_widgets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <ChatSettingsPage initialWidgets={widgets || []} />
}
