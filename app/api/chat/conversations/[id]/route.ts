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

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        visitor:chat_visitors(*),
        messages:chat_messages(*)
      `)
      .eq('id', id)
      .order('created_at', { referencedTable: 'chat_messages', ascending: true })
      .single()

    if (error || !conversation) {
      return NextResponse.json({ error: '会話が見つかりません' }, { status: 404 })
    }

    // Verify ownership through widget
    const { data: widget } = await supabase
      .from('chat_widgets')
      .select('id')
      .eq('id', conversation.widget_id)
      .eq('user_id', user.id)
      .single()

    if (!widget) {
      return NextResponse.json({ error: '会話が見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ data: conversation })
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

    // Verify ownership through widget
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('widget_id')
      .eq('id', id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: '会話が見つかりません' }, { status: 404 })
    }

    const { data: widget } = await supabase
      .from('chat_widgets')
      .select('id')
      .eq('id', conversation.widget_id)
      .eq('user_id', user.id)
      .single()

    if (!widget) {
      return NextResponse.json({ error: '会話が見つかりません' }, { status: 404 })
    }

    // Delete messages first, then conversation
    await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', id)

    await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', id)

    return NextResponse.json({ success: true })
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
    const { status, assigned_to } = body

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) {
      updateData.status = status
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
      }
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to
      if (!updateData.status) {
        updateData.status = 'assigned'
      }
    }

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        visitor:chat_visitors(*)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: conversation })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
