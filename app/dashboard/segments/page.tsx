import { createClient } from '@/lib/supabase/server'
import { SegmentsClient } from '@/components/segments/segments-client'

export default async function SegmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // 全てのクエリを並列実行
  const [segmentsResult, tagsResult, customFieldsResult] = await Promise.all([
    supabase
      .from('segments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name'),
    supabase
      .from('custom_fields')
      .select('id, name, field_key')
      .eq('user_id', user.id)
      .order('name'),
  ])

  return (
    <SegmentsClient
      segments={segmentsResult.data || []}
      tags={tagsResult.data || []}
      customFields={customFieldsResult.data || []}
    />
  )
}
