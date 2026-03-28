import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    const offset = (page - 1) * perPage

    const { data: messages, count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + perPage - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: messages,
      meta: { total: count || 0, page, per_page: perPage },
    })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'メッセージは必須です' }, { status: 400 })
    }

    // Verify conversation exists and user owns the widget
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('widget_id, visitor_id, contact_id')
      .eq('id', id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: '会話が見つかりません' }, { status: 404 })
    }

    const { data: widget } = await supabase
      .from('chat_widgets')
      .select('user_id')
      .eq('id', conversation.widget_id)
      .single()

    if (!widget || widget.user_id !== user.id) {
      return NextResponse.json({ error: '会話が見つかりません' }, { status: 404 })
    }

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: id,
        role: 'agent',
        sender_id: user.id,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create contact activity if contact exists
    if (conversation.contact_id) {
      await supabase.from('contact_activities').insert({
        contact_id: conversation.contact_id,
        user_id: user.id,
        type: 'chat_reply',
        metadata: {
          conversation_id: id,
          message_id: message.id,
        },
      })
    }

    return NextResponse.json({ data: message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
