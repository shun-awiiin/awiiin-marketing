import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateEnrollmentSchema } from '@/lib/validation/l-step'

// GET /api/scenarios/[id]/enrollments/[enrollmentId] - Get enrollment details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  try {
    const { id: scenarioId, enrollmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify ownership through scenario
    const { data: scenario } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', scenarioId)
      .eq('user_id', user.id)
      .single()

    if (!scenario) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('scenario_enrollments')
      .select(`
        *,
        contact:contacts(id, email, first_name, company),
        current_step:scenario_steps(id, name, step_type, config)
      `)
      .eq('id', enrollmentId)
      .eq('scenario_id', scenarioId)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: '登録が見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/scenarios/[id]/enrollments/[enrollmentId] - Update enrollment (pause/resume)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  try {
    const { id: scenarioId, enrollmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify ownership through scenario
    const { data: scenario } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', scenarioId)
      .eq('user_id', user.id)
      .single()

    if (!scenario) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateEnrollmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { ...validation.data }

    // If pausing, clear next_action_at
    if (validation.data.status === 'paused') {
      updateData.next_action_at = null
    }

    // If resuming, set next_action_at to now
    if (validation.data.status === 'active') {
      updateData.next_action_at = new Date().toISOString()
    }

    // If exiting, mark as completed
    if (validation.data.status === 'exited') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('scenario_enrollments')
      .update(updateData)
      .eq('id', enrollmentId)
      .eq('scenario_id', scenarioId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/scenarios/[id]/enrollments/[enrollmentId] - Remove enrollment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  try {
    const { id: scenarioId, enrollmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify ownership through scenario
    const { data: scenario } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', scenarioId)
      .eq('user_id', user.id)
      .single()

    if (!scenario) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    const { error } = await supabase
      .from('scenario_enrollments')
      .delete()
      .eq('id', enrollmentId)
      .eq('scenario_id', scenarioId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
