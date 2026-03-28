import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatInbox } from '@/components/chat/chat-inbox'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get widgets owned by user
  const { data: widgets } = await supabase
    .from('chat_widgets')
    .select('id')
    .eq('user_id', user.id)

  const widgetIds = widgets?.map((w) => w.id) || []

  // Get conversations with visitor info and last message
  let conversations: Array<Record<string, unknown>> = []

  if (widgetIds.length > 0) {
    const { data } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        visitor:chat_visitors(*),
        messages:chat_messages(id, content, role, created_at)
      `)
      .in('widget_id', widgetIds)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'chat_messages', ascending: false })
      .limit(50)

    conversations = (data || []).map((conv) => {
      const lastMessage = conv.messages?.[0] || null
      return { ...conv, messages: undefined, last_message: lastMessage }
    })
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <ChatInbox
        initialConversations={conversations}
        userId={user.id}
      />
    </div>
  )
}
