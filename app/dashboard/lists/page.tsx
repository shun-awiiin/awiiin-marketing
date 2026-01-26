import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ListsClient } from '@/components/lists/lists-client'

export default async function ListsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: lists } = await supabase
    .from('lists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <ListsClient lists={lists || []} />
}
