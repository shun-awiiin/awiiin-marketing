import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScenarioDetailClient } from '@/components/scenarios/scenario-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScenarioDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: scenario } = await supabase
    .from('scenarios')
    .select(`
      *,
      scenario_steps(*)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!scenario) {
    notFound()
  }

  // Sort steps
  const sortedSteps = (scenario.scenario_steps || []).sort(
    (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
  )

  // Get stats
  const { data: stats } = await supabase.rpc('get_scenario_stats', {
    p_scenario_id: id
  })

  // Get tags for condition configuration
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  // Get custom fields
  const { data: customFields } = await supabase
    .from('custom_fields')
    .select('id, name, field_key')
    .eq('user_id', user.id)
    .order('name')

  return (
    <ScenarioDetailClient
      scenario={{
        ...scenario,
        scenario_steps: sortedSteps,
        stats: stats?.[0] || {
          total_enrolled: 0,
          active_count: 0,
          completed_count: 0,
          paused_count: 0,
          exited_count: 0
        }
      }}
      tags={tags || []}
      customFields={customFields || []}
    />
  )
}
