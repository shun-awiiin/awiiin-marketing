import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateSegmentSchema } from '@/lib/validation/l-step'
import { countSegmentContacts } from '@/lib/segments/segment-evaluator'

// GET /api/segments/[id] - Get segment details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const { data: segment, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      // Table doesn't exist or segment not found
      console.error('Segment fetch error:', error.code, error.message)
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    if (!segment) {
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    // Update contact count
    let contactCount = 0
    try {
      contactCount = await countSegmentContacts(supabase, user.id, segment.rules)
    } catch {
      // Ignore count errors
    }

    return NextResponse.json({
      success: true,
      data: { ...segment, contact_count: contactCount }
    })
  } catch (err) {
    console.error('Segment GET error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/segments/[id] - Update segment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = updateSegmentSchema.safeParse(body)

    if (!validation.success) {
      console.error('Segment validation error:', validation.error.errors)
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: existingError } = await supabase
      .from('segments')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError) {
      console.error('Segment verify error:', existingError.code, existingError.message)
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    if (!existing) {
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    // Calculate new contact count if rules changed
    let contactCount
    if (validation.data.rules) {
      try {
        contactCount = await countSegmentContacts(supabase, user.id, validation.data.rules)
      } catch {
        contactCount = 0
      }
    }

    const { data, error } = await supabase
      .from('segments')
      .update({
        ...validation.data,
        ...(contactCount !== undefined && { contact_count: contactCount })
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Segment update error:', error.code, error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Segment PUT error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/segments/[id] - Delete segment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const { error } = await supabase
      .from('segments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
