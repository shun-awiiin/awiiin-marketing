import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { TimelineQuerySchema } from '@/lib/types/timeline'

// GET /api/contacts/:id/timeline - Fetch combined timeline
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const parsed = TimelineQuerySchema.safeParse({
      page: searchParams.get('page') || '1',
      per_page: searchParams.get('per_page') || '20',
      activity_type: searchParams.get('activity_type') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { page, per_page, activity_type } = parsed.data
    const offset = (page - 1) * per_page

    let query = supabase
      .from('contact_activities')
      .select('*', { count: 'exact' })
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + per_page - 1)

    if (activity_type) {
      query = query.eq('activity_type', activity_type)
    }

    const { data: activities, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = count || 0

    return NextResponse.json({
      data: activities || [],
      meta: {
        total,
        page,
        per_page,
        has_more: offset + per_page < total,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
