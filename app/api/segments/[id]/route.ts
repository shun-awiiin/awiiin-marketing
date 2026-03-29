import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { updateSegmentSchema } from '@/lib/validation/l-step'
import { countSegmentContacts } from '@/lib/segments/segment-evaluator'

// GET /api/segments/[id] - Get segment details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data: segment, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (error || !segment) {
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    let contactCount = 0
    try {
      contactCount = await countSegmentContacts(supabase, ctx.user.id, segment.rules)
    } catch {
      // Ignore count errors
    }

    return NextResponse.json({
      success: true,
      data: { ...segment, contact_count: contactCount }
    })
  } catch {
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
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const body = await request.json()
    const validation = updateSegmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('segments')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    let contactCount
    if (validation.data.rules) {
      try {
        contactCount = await countSegmentContacts(supabase, ctx.user.id, validation.data.rules)
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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
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
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { error } = await supabase
      .from('segments')
      .delete()
      .eq('id', id)
      .eq(filterCol, filterVal)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
