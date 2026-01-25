import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFunnelStepSchema } from '@/lib/types/tracking'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (funnelError || !funnel) {
      return NextResponse.json(
        { success: false, error: 'ファネルが見つかりません' },
        { status: 404 }
      )
    }

    const { data: steps, error } = await supabase
      .from('funnel_steps')
      .select('*')
      .eq('funnel_id', id)
      .order('step_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: steps,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (funnelError || !funnel) {
      return NextResponse.json(
        { success: false, error: 'ファネルが見つかりません' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = createFunnelStepSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { data: step, error } = await supabase
      .from('funnel_steps')
      .insert({
        funnel_id: id,
        step_type: validation.data.step_type,
        step_order: validation.data.step_order,
        name: validation.data.name,
        page_id: validation.data.page_id || null,
        target_url: validation.data.target_url || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: step,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
