import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { createScenarioSchema } from '@/lib/validation/l-step'

// GET /api/scenarios - List scenarios
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const offset = (page - 1) * perPage

    let query = supabase
      .from('scenarios')
      .select('*', { count: 'exact' })
      .eq(filterCol, filterVal)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: scenarios, count, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

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
      meta: { total: count || 0, page, per_page: perPage }
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/scenarios - Create scenario
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
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
      .insert({
        ...validation.data,
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
