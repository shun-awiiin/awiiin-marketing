import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ slug: string }> }

// GET /api/forms/public/:slug - Public form data (no auth required)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = await createServiceClient()

    const { data: form, error } = await supabase
      .from('standalone_forms')
      .select('id, name, slug, description, fields, settings, style')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (error || !form) {
      return NextResponse.json(
        { error: 'フォームが見つからないか、現在受付を停止しています' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: form })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
