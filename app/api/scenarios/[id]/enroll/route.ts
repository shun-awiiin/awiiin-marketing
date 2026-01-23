import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrollContactsSchema } from '@/lib/validation/l-step'

// POST /api/scenarios/[id]/enroll - Enroll contacts in scenario
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

    // Verify ownership and get scenario
    const { data: scenario } = await supabase
      .from('scenarios')
      .select('id, status')
      .eq('id', scenarioId)
      .eq('user_id', user.id)
      .single()

    if (!scenario) {
      return NextResponse.json({ success: false, error: 'シナリオが見つかりません' }, { status: 404 })
    }

    if (scenario.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'シナリオが有効化されていません。まず有効化してください。'
      }, { status: 400 })
    }

    const body = await request.json()
    const validation = enrollContactsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { contact_ids } = validation.data

    // Get first step
    const { data: firstStep } = await supabase
      .from('scenario_steps')
      .select('id')
      .eq('scenario_id', scenarioId)
      .order('step_order', { ascending: true })
      .limit(1)
      .single()

    if (!firstStep) {
      return NextResponse.json({
        success: false,
        error: 'シナリオにステップがありません。先にステップを追加してください。'
      }, { status: 400 })
    }

    // Verify contacts belong to user
    const { data: validContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .in('id', contact_ids)

    const validContactIds = validContacts?.map(c => c.id) || []

    if (validContactIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '有効なコンタクトが見つかりません'
      }, { status: 400 })
    }

    // Create enrollments
    const enrollments = validContactIds.map((contact_id) => ({
      scenario_id: scenarioId,
      contact_id,
      current_step_id: firstStep.id,
      status: 'active' as const,
      next_action_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('scenario_enrollments')
      .upsert(enrollments, {
        onConflict: 'scenario_id,contact_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      enrolled: data?.length || 0,
      skipped: contact_ids.length - validContactIds.length
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/scenarios/[id]/enroll - Get enrollments
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const offset = (page - 1) * perPage

    let query = supabase
      .from('scenario_enrollments')
      .select(`
        *,
        contact:contacts(id, email, first_name),
        current_step:scenario_steps(id, name, step_type)
      `, { count: 'exact' })
      .eq('scenario_id', scenarioId)
      .order('enrolled_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
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
