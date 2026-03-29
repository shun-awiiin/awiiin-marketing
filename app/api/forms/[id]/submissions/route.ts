import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/forms/:id/submissions
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

    // Verify form ownership
    const { data: form } = await supabase
      .from('standalone_forms')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single()

    if (!form) {
      return NextResponse.json({ error: 'フォームが見つかりません' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, parseInt(searchParams.get('per_page') || '20'))
    const offset = (page - 1) * perPage

    const { data, count, error } = await supabase
      .from('standalone_form_submissions')
      .select('*', { count: 'exact' })
      .eq('form_id', id)
      .order('submitted_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      meta: { total: count || 0, page, per_page: perPage },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
