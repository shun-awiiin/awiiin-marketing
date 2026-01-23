import { createClient } from '@/lib/supabase/server'
import { SegmentsClient } from '@/components/segments/segments-client'

export default async function SegmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: segments } = await supabase
    .from('segments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: tags } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  const { data: customFields } = await supabase
    .from('custom_fields')
    .select('id, name, field_key')
    .eq('user_id', user.id)
    .order('name')

  return (
    <SegmentsClient
      segments={segments || []}
      tags={tags || []}
      customFields={customFields || []}
    />
  )
}
