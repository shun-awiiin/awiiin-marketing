import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateStepSchema } from '@/lib/validation/l-step'

// GET /api/scenarios/[id]/steps/[stepId] - Get step details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: scenarioId, stepId } = await params
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
      .from('scenario_steps')
      .select('*')
      .eq('id', stepId)
      .eq('scenario_id', scenarioId)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'ステップが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/scenarios/[id]/steps/[stepId] - Update step
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: scenarioId, stepId } = await params
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
    const validation = updateStepSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('scenario_steps')
      .update(validation.data)
      .eq('id', stepId)
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

// DELETE /api/scenarios/[id]/steps/[stepId] - Delete step
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: scenarioId, stepId } = await params
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

    // Get the step to delete
    const { data: stepToDelete } = await supabase
      .from('scenario_steps')
      .select('*')
      .eq('id', stepId)
      .eq('scenario_id', scenarioId)
      .single()

    if (!stepToDelete) {
      return NextResponse.json({ success: false, error: 'ステップが見つかりません' }, { status: 404 })
    }

    // Update previous step's next_step_id to point to deleted step's next_step
    await supabase
      .from('scenario_steps')
      .update({ next_step_id: stepToDelete.next_step_id })
      .eq('scenario_id', scenarioId)
      .eq('next_step_id', stepId)

    // Delete the step
    const { error } = await supabase
      .from('scenario_steps')
      .delete()
      .eq('id', stepId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Reorder remaining steps
    const { data: remainingSteps } = await supabase
      .from('scenario_steps')
      .select('id')
      .eq('scenario_id', scenarioId)
      .order('step_order', { ascending: true })

    if (remainingSteps) {
      for (let i = 0; i < remainingSteps.length; i++) {
        await supabase
          .from('scenario_steps')
          .update({ step_order: i + 1 })
          .eq('id', remainingSteps[i].id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
