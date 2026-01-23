import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScenarioSchema } from '@/lib/validation/l-step'

// GET /api/scenarios - List scenarios
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const offset = (page - 1) * perPage

    let query = supabase
      .from('scenarios')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: scenarios, count, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

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
            completed_count: 0,
            paused_count: 0,
            exited_count: 0
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: scenariosWithStats,
      meta: {
        total: count || 0,
        page,
        per_page: perPage
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/scenarios - Create scenario
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createScenarioSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('scenarios')
      .insert({ ...validation.data, user_id: user.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
