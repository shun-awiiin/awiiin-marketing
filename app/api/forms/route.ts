import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateFormSchema } from '@/lib/types/forms'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80) + '-' + Date.now().toString(36)
}

// GET /api/forms - List forms
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, parseInt(searchParams.get('per_page') || '20'))
    const status = searchParams.get('status')
    const offset = (page - 1) * perPage

    let query = supabase
      .from('standalone_forms')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, count, error } = await query

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

// POST /api/forms - Create form
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = CreateFormSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, description, fields, settings, style } = validation.data
    const slug = generateSlug(name)

    const defaultSettings = {
      submitLabel: '送信',
      successMessage: '送信が完了しました。ありがとうございます。',
      redirectUrl: null,
      notifyEmail: null,
      autoReplyEnabled: false,
      autoReplySubject: 'お問い合わせありがとうございます',
      autoReplyBody: null,
      autoReplyTemplateId: null,
      scenarioId: null,
      tagIds: [],
    }

    const { data, error } = await supabase
      .from('standalone_forms')
      .insert({
        user_id: user.id,
        name,
        slug,
        description: description ?? null,
        fields,
        settings: { ...defaultSettings, ...settings },
        style: style ?? {},
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
