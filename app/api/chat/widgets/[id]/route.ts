import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data: widget, error } = await supabase
      .from('chat_widgets')
      .select('*')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (error || !widget) {
      return NextResponse.json({ error: 'ウィジェットが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ data: widget })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
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
    const { name, settings, allowed_domains, is_active } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (settings !== undefined) updateData.settings = settings
    if (allowed_domains !== undefined) updateData.allowed_domains = allowed_domains
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: widget, error } = await supabase
      .from('chat_widgets')
      .update(updateData)
      .eq('id', id)
      .eq(filterCol, filterVal)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!widget) {
      return NextResponse.json({ error: 'ウィジェットが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ data: widget })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
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
      .from('chat_widgets')
      .delete()
      .eq('id', id)
      .eq(filterCol, filterVal)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
