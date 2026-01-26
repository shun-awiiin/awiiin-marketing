import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSegmentSchema } from '@/lib/validation/l-step'
import { countSegmentContacts } from '@/lib/segments/segment-evaluator'

// GET /api/segments - List segments
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table doesn't exist yet - return empty array
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({ success: true, data: [] })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Update contact counts
    const segmentsWithCounts = await Promise.all(
      (data || []).map(async (segment) => {
        const count = await countSegmentContacts(supabase, user.id, segment.rules)
        return { ...segment, contact_count: count }
      })
    )

    return NextResponse.json({ success: true, data: segmentsWithCounts })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/segments - Create segment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createSegmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Calculate initial contact count
    const contactCount = await countSegmentContacts(supabase, user.id, validation.data.rules)

    const { data, error } = await supabase
      .from('segments')
      .insert({
        ...validation.data,
        user_id: user.id,
        contact_count: contactCount
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
