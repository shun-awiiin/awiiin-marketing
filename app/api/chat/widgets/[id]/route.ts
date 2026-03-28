import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { data: widget, error } = await supabase
      .from('chat_widgets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !widget) {
      return NextResponse.json({ error: 'ウィジェットが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ data: widget })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { name, settings, allowed_domains, is_active } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (settings !== undefined) updateData.settings = settings
    if (allowed_domains !== undefined) updateData.allowed_domains = allowed_domains
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: widget, error } = await supabase
      .from('chat_widgets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!widget) {
      return NextResponse.json({ error: 'ウィジェットが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ data: widget })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { error } = await supabase
      .from('chat_widgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
