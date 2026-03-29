import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    const { widget_id, email, name, message, visitor_id } = body

    if (!widget_id) {
      return NextResponse.json({ error: 'widget_id is required' }, { status: 400 })
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // Verify widget exists and is active
    const { data: widget, error: widgetError } = await supabase
      .from('chat_widgets')
      .select('id, is_active, settings')
      .eq('id', widget_id)
      .single()

    if (widgetError || !widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    if (!widget.is_active) {
      return NextResponse.json({ error: 'Widget is inactive' }, { status: 403 })
    }

    // Try to find existing open conversation by visitor_id (from localStorage) or email
    const lookupIds: string[] = []

    if (visitor_id) {
      // Check if this visitor_id exists
      const { data: visitorById } = await supabase
        .from('chat_visitors')
        .select('id')
        .eq('id', visitor_id)
        .eq('widget_id', widget_id)
        .maybeSingle()
      if (visitorById) lookupIds.push(visitorById.id)
    }

    if (email) {
      const { data: visitorByEmail } = await supabase
        .from('chat_visitors')
        .select('id')
        .eq('widget_id', widget_id)
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (visitorByEmail && !lookupIds.includes(visitorByEmail.id)) {
        lookupIds.push(visitorByEmail.id)
      }
    }

    if (lookupIds.length > 0) {
      const { data: existingConv } = await supabase
        .from('chat_conversations')
        .select('id, visitor_id')
        .eq('widget_id', widget_id)
        .in('visitor_id', lookupIds)
        .in('status', ['open', 'assigned'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingConv) {
        await supabase
          .from('chat_messages')
          .insert({
            conversation_id: existingConv.id,
            role: 'visitor',
            sender_id: existingConv.visitor_id,
            content: message.trim(),
          })

        return NextResponse.json(
          {
            data: {
              conversation_id: existingConv.id,
              visitor_id: existingConv.visitor_id,
            },
          },
          { status: 201 }
        )
      }
    }

    // No existing open conversation found - create new visitor and conversation

    // Create visitor
    const { data: visitor, error: visitorError } = await supabase
      .from('chat_visitors')
      .insert({
        widget_id,
        email: email || null,
        name: name || null,
      })
      .select()
      .single()

    if (visitorError || !visitor) {
      return NextResponse.json(
        { error: 'Failed to create visitor' },
        { status: 500 }
      )
    }

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .insert({
        widget_id,
        visitor_id: visitor.id,
        contact_id: visitor.contact_id || null,
        status: 'open',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    // Create first message
    const { error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'visitor',
        sender_id: visitor.id,
        content: message.trim(),
      })

    if (msgError) {
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: {
          conversation_id: conversation.id,
          visitor_id: visitor.id,
        },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
