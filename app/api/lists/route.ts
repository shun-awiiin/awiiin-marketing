import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createListSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
})

// GET /api/lists - List all lists
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const { data: lists, error } = await supabase
      .from('lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table doesn't exist yet or other schema errors - return empty array
      // Supabase error codes: 42P01 (table not found), PGRST116 (relation not found)
      console.error('Lists fetch error:', error.code, error.message)
      return NextResponse.json({ success: true, data: [] })
    }

    return NextResponse.json({ success: true, data: lists || [] })
  } catch (err) {
    console.error('Lists API error:', err)
    // Return empty array instead of error for better UX
    return NextResponse.json({ success: true, data: [] })
  }
}

// POST /api/lists - Create list
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createListSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { name, description, color } = validation.data

    // Check for duplicate
    const { data: existing } = await supabase
      .from('lists')
      .select('id')
      .eq('user_id', user.id)
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
        user_id: user.id,
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
