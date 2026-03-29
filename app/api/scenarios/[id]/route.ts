import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { updateScenarioSchema } from '@/lib/validation/l-step'

// GET /api/scenarios/[id] - Get scenario details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data: scenario, error } = await supabase
      .from('scenarios')
      .select(`*, scenario_steps(*)`)
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (error || !scenario) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    const sortedSteps = (scenario.scenario_steps || []).sort(
      (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
    )

    const { data: stats } = await supabase.rpc('get_scenario_stats', {
      p_scenario_id: id
    })

    return NextResponse.json({
      success: true,
      data: {
        ...scenario,
        scenario_steps: sortedSteps,
        stats: stats?.[0] || {
          total_enrolled: 0,
          active_count: 0,
          completed_count: 0,
          paused_count: 0,
          exited_count: 0
        }
      }
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/scenarios/[id] - Update scenario
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const body = await request.json()
    const validation = updateScenarioSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('scenarios')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/scenarios/[id] - Delete scenario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data: existing } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
