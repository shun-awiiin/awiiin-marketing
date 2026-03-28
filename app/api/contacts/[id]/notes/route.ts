import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateNoteSchema, UpdateNoteSchema } from '@/lib/types/timeline'

// GET /api/contacts/:id/notes - List notes for contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { data: notes, count, error } = await supabase
      .from('contact_notes')
      .select('*', { count: 'exact' })
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Notes fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: notes || [],
      meta: { total: count || 0 },
    })
  } catch (error) {
    console.error('Notes GET error:', error)
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Validate body
    const body = await request.json()
    const parsed = CreateNoteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Insert note
    const { data: note, error: noteError } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: id,
        user_id: user.id,
        content: parsed.data.content,
      })
      .select()
      .single()

    if (noteError) {
      console.error('Note create error:', noteError)
      return NextResponse.json({ error: noteError.message }, { status: 500 })
    }

    // Create corresponding activity
    const { error: activityError } = await supabase
      .from('contact_activities')
      .insert({
        contact_id: id,
        user_id: user.id,
        activity_type: 'note_added',
        title: 'ノートを追加',
        description: parsed.data.content.slice(0, 200),
        metadata: { note_id: note.id },
        reference_type: 'contact_notes',
        reference_id: note.id,
        occurred_at: new Date().toISOString(),
      })

    if (activityError) {
      console.error('Activity create error:', activityError)
      // Note was created successfully, don't fail the request
    }

    return NextResponse.json({ data: note }, { status: 201 })
  } catch (error) {
    console.error('Notes POST error:', error)
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { data: note, error: noteError } = await supabase
      .from('contact_notes')
      .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (noteError) {
      console.error('Note update error:', noteError)
      return NextResponse.json({ error: noteError.message }, { status: 500 })
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ data: note })
  } catch (error) {
    console.error('Notes PATCH error:', error)
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId)
      .eq('contact_id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Note delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Also delete the corresponding activity
    await supabase
      .from('contact_activities')
      .delete()
      .eq('reference_type', 'contact_notes')
      .eq('reference_id', noteId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notes DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
