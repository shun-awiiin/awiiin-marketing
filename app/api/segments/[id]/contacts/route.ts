import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateSegment } from '@/lib/segments/segment-evaluator'

// GET /api/segments/[id]/contacts - Get contacts in segment
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')

    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (segmentError || !segment) {
      return NextResponse.json({ success: false, error: 'セグメントが見つかりません' }, { status: 404 })
    }

    const contacts = await evaluateSegment(supabase, user.id, segment.rules)

    // Paginate
    const start = (page - 1) * perPage
    const paginatedContacts = contacts.slice(start, start + perPage)

    return NextResponse.json({
      success: true,
      data: paginatedContacts,
      meta: {
        total: contacts.length,
        page,
        per_page: perPage
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
