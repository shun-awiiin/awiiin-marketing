import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createStepSchema, reorderStepsSchema } from '@/lib/validation/l-step'

// GET /api/scenarios/[id]/steps - List steps
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scenarioId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify ownership
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
      .eq('scenario_id', scenarioId)
      .order('step_order', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/scenarios/[id]/steps - Add step
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scenarioId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify ownership
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
    const validation = createStepSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Get max step_order
    const { data: lastStep } = await supabase
      .from('scenario_steps')
      .select('step_order')
      .eq('scenario_id', scenarioId)
      .order('step_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (lastStep?.step_order || 0) + 1

    // Create step
    const { data, error } = await supabase
      .from('scenario_steps')
      .insert({
        scenario_id: scenarioId,
        step_order: nextOrder,
        ...validation.data
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Update previous step's next_step_id
    if (lastStep) {
      await supabase
        .from('scenario_steps')
        .update({ next_step_id: data.id })
        .eq('scenario_id', scenarioId)
        .eq('step_order', lastStep.step_order)
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/scenarios/[id]/steps - Reorder steps
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scenarioId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify ownership
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
    const validation = reorderStepsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { step_ids } = validation.data

    // Update step orders
    for (let i = 0; i < step_ids.length; i++) {
      await supabase
        .from('scenario_steps')
        .update({
          step_order: i + 1,
          next_step_id: i < step_ids.length - 1 ? step_ids[i + 1] : null
        })
        .eq('id', step_ids[i])
        .eq('scenario_id', scenarioId)
    }

    // Fetch updated steps
    const { data } = await supabase
      .from('scenario_steps')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('step_order', { ascending: true })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
