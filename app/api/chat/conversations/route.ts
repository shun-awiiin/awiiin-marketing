import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const widgetId = searchParams.get('widget_id')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const offset = (page - 1) * perPage

    // Get widget IDs owned by this user
    const { data: widgets } = await supabase
      .from('chat_widgets')
      .select('id')
      .eq('user_id', user.id)

    if (!widgets || widgets.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { total: 0, page, per_page: perPage },
      })
    }

    const widgetIds = widgets.map((w) => w.id)

    let query = supabase
      .from('chat_conversations')
      .select(
        `
        *,
        visitor:chat_visitors(*),
        messages:chat_messages(id, content, role, created_at)
      `,
        { count: 'exact' }
      )
      .in('widget_id', widgetIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (widgetId) {
      query = query.eq('widget_id', widgetId)
    }

    // Order messages to get latest
    query = query.order('created_at', {
      referencedTable: 'chat_messages',
      ascending: false,
    })

    const { data: conversations, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to include only the last message
    const transformed = (conversations || []).map((conv) => {
      const lastMessage =
        conv.messages && conv.messages.length > 0 ? conv.messages[0] : null
      return {
        ...conv,
        messages: undefined,
        last_message: lastMessage,
      }
    })

    return NextResponse.json({
      data: transformed,
      meta: { total: count || 0, page, per_page: perPage },
    })
  } catch {
    return NextResponse.json(
      { error: '内部エラーが発生しました' },
      { status: 500 }
    )
  }
}
