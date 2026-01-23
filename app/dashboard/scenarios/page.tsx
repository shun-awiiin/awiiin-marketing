import { createClient } from '@/lib/supabase/server'
import { ScenariosClient } from '@/components/scenarios/scenarios-client'

export default async function ScenariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Get stats for each scenario
  const scenariosWithStats = await Promise.all(
    (scenarios || []).map(async (scenario) => {
      const { data: stats } = await supabase.rpc('get_scenario_stats', {
        p_scenario_id: scenario.id
      })

      const { count: stepCount } = await supabase
        .from('scenario_steps')
        .select('*', { count: 'exact', head: true })
        .eq('scenario_id', scenario.id)

      return {
        ...scenario,
        step_count: stepCount || 0,
        stats: stats?.[0] || {
          total_enrolled: 0,
          active_count: 0,
          completed_count: 0
        }
      }
    })
  )

  return <ScenariosClient scenarios={scenariosWithStats} />
}
