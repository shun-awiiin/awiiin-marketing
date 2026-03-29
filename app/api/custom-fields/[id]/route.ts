import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { updateCustomFieldSchema } from '@/lib/validation/l-step'

// GET /api/custom-fields/[id] - Get custom field details
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

    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'カスタム属性が見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/custom-fields/[id] - Update custom field
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
    const validation = updateCustomFieldSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('custom_fields')
      .update(validation.data)
      .eq('id', id)
      .eq(filterCol, filterVal)
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

// DELETE /api/custom-fields/[id] - Delete custom field
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
      .from('custom_fields')
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
