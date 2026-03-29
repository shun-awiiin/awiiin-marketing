import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context'
import { z } from 'zod'

const createListSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
})

// GET /api/lists - List all lists
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const { data: lists, error } = await supabase
      .from('lists')
      .select('*')
      .eq(filterCol, filterVal)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: true, data: [] })
    }

    return NextResponse.json({ success: true, data: lists || [] })
  } catch {
    return NextResponse.json({ success: true, data: [] })
  }
}

// POST /api/lists - Create list
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request)
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status })
    }

    const supabase = await createServiceClient()
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id'
    const filterVal = ctx.orgId || ctx.user.id

    const body = await request.json()
    const validation = createListSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { name, description, color } = validation.data

    const { data: existing } = await supabase
      .from('lists')
      .select('id')
      .eq(filterCol, filterVal)
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: '同じ名前のリストが既に存在します'
      }, { status: 409 })
    }

    const { data: list, error } = await supabase
      .from('lists')
      .insert({
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        name,
        description: description || null,
        color: color || '#6B7280'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: list }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
