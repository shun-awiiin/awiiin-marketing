import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const widgetId = searchParams.get('widget_id')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')
    const offset = (page - 1) * perPage

    // Get widget IDs owned by this org/user
    const { data: widgets } = await supabase
      .from('chat_widgets')
      .select('id')
      .eq(filterCol, filterVal)

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

    query = query.order('created_at', {
      referencedTable: 'chat_messages',
      ascending: false,
    })

    const { data: conversations, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
