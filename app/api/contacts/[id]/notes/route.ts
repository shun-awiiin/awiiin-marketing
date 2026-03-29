import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { CreateNoteSchema, UpdateNoteSchema } from '@/lib/types/timeline'

// GET /api/contacts/:id/notes - List notes for contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    // Verify ownership
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { data: notes, count, error } = await supabase
      .from('contact_notes')
      .select('*', { count: 'exact' })
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: notes || [],
      meta: { total: count || 0 },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/contacts/:id/notes - Create note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    // Verify ownership
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = CreateNoteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: note, error: noteError } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: id,
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        content: parsed.data.content,
      })
      .select()
      .single()

    if (noteError) {
      return NextResponse.json({ error: noteError.message }, { status: 500 })
    }

    // Create corresponding activity
    await supabase
      .from('contact_activities')
      .insert({
        contact_id: id,
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        activity_type: 'note_added',
        title: 'ノートを追加',
        description: parsed.data.content.slice(0, 200),
        metadata: { note_id: note.id },
        reference_type: 'contact_notes',
        reference_id: note.id,
        occurred_at: new Date().toISOString(),
      })

    return NextResponse.json({ data: note }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/contacts/:id/notes - Update note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const body = await request.json()
    const noteId = body.note_id
    if (!noteId || typeof noteId !== 'string') {
      return NextResponse.json({ error: 'note_id is required' }, { status: 400 })
    }

    const parsed = UpdateNoteSchema.safeParse({ content: body.content })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Verify ownership via contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { data: note, error: noteError } = await supabase
      .from('contact_notes')
      .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('contact_id', id)
      .select()
      .single()

    if (noteError) {
      return NextResponse.json({ error: noteError.message }, { status: 500 })
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ data: note })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/contacts/:id/notes - Delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const body = await request.json()
    const noteId = body.note_id
    if (!noteId || typeof noteId !== 'string') {
      return NextResponse.json({ error: 'note_id is required' }, { status: 400 })
    }

    // Verify ownership via contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId)
      .eq('contact_id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Also delete the corresponding activity
    await supabase
      .from('contact_activities')
      .delete()
      .eq('reference_type', 'contact_notes')
      .eq('reference_id', noteId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
