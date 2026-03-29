import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ conversationId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { conversationId } = await params
    const visitorId = request.headers.get('x-visitor-id')

    if (!visitorId) {
      return NextResponse.json({ error: 'Visitor ID is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Verify conversation belongs to this visitor
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('visitor_id', visitorId)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: messages })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { conversationId } = await params
    const visitorId = request.headers.get('x-visitor-id')

    if (!visitorId) {
      return NextResponse.json({ error: 'Visitor ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { content, metadata } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Verify conversation belongs to this visitor
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .eq('visitor_id', visitorId)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.status === 'closed') {
      return NextResponse.json({ error: 'Conversation is closed' }, { status: 403 })
    }

    const insertData: Record<string, unknown> = {
      conversation_id: conversationId,
      role: 'visitor',
      sender_id: visitorId,
      content: content.trim(),
    }
    if (metadata && typeof metadata === 'object') {
      insertData.metadata = metadata
    }

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Reopen if resolved
    if (conversation.status === 'resolved') {
      await supabase
        .from('chat_conversations')
        .update({ status: 'open', resolved_at: null })
        .eq('id', conversationId)
    }

    return NextResponse.json({ data: message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
