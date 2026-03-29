import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { UpdateFormSchema } from '@/lib/types/forms'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/forms/:id
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data, error } = await supabase
      .from('standalone_forms')
      .select('*')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'フォームが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/forms/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const validation = UpdateFormSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('standalone_forms')
      .select('id, settings')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'フォームが見つかりません' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    const { name, description, status, fields, settings, style } = validation.data

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (status !== undefined) updates.status = status
    if (fields !== undefined) updates.fields = fields
    if (style !== undefined) updates.style = style
    if (settings !== undefined) {
      updates.settings = { ...existing.settings, ...settings }
    }

    const { data, error } = await supabase
      .from('standalone_forms')
      .update(updates)
      .eq('id', id)
      .eq(filterCol, filterVal)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/forms/:id
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { error } = await supabase
      .from('standalone_forms')
      .delete()
      .eq('id', id)
      .eq(filterCol, filterVal)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
