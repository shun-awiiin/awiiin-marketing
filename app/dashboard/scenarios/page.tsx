import { createClient } from '@/lib/supabase/server'
import { ScenariosClient } from '@/components/scenarios/scenarios-client'

export default async function ScenariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // シナリオとステップ数を一緒に取得（JOINでN+1解消）
  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*, scenario_steps(id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!scenarios || scenarios.length === 0) {
    return <ScenariosClient scenarios={[]} />
  }

  // 統計取得を並列化（完全なN+1解消ではないが高速化）
  const statsPromises = scenarios.map((scenario) =>
    supabase.rpc('get_scenario_stats', { p_scenario_id: scenario.id })
  )
  const statsResults = await Promise.all(statsPromises)

  // シナリオにstatsを結合
  const scenariosWithStats = scenarios.map((scenario, index) => ({
    ...scenario,
    step_count: scenario.scenario_steps?.length || 0,
    scenario_steps: undefined,
    stats: statsResults[index].data?.[0] || {
      total_enrolled: 0,
      active_count: 0,
      completed_count: 0
    }
  }))

  return <ScenariosClient scenarios={scenariosWithStats} />
}
