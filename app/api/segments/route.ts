import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { createSegmentSchema } from '@/lib/validation/l-step'
import { countSegmentContacts } from '@/lib/segments/segment-evaluator'

// GET /api/segments - List segments
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq(filterCol, filterVal)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: true, data: [] })
    }

    const segmentsWithCounts = await Promise.all(
      (data || []).map(async (segment) => {
        try {
          const count = await countSegmentContacts(supabase, ctx.user.id, segment.rules)
          return { ...segment, contact_count: count }
        } catch {
          return { ...segment, contact_count: 0 }
        }
      })
    )

    return NextResponse.json({ success: true, data: segmentsWithCounts })
  } catch {
    return NextResponse.json({ success: true, data: [] })
  }
}

// POST /api/segments - Create segment
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const body = await request.json()
    const validation = createSegmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const contactCount = await countSegmentContacts(supabase, ctx.user.id, validation.data.rules)

    const { data, error } = await supabase
      .from('segments')
      .insert({
        ...validation.data,
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        contact_count: contactCount
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
