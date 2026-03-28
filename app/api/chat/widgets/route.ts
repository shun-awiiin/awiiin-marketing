import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { data: widgets, error } = await supabase
      .from('chat_widgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: widgets })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { name, settings, allowed_domains } = body

    if (!name) {
      return NextResponse.json({ error: 'ウィジェット名は必須です' }, { status: 400 })
    }

    const defaultSettings = {
      position: 'bottom-right' as const,
      primaryColor: '#2563eb',
      greeting: 'こんにちは！何かお手伝いできることはありますか？',
      placeholder: 'メッセージを入力...',
      offlineMessage: '現在オフラインです。メールアドレスを残していただければ、後ほどご連絡いたします。',
      requireEmail: false,
    }

    const { data: widget, error } = await supabase
      .from('chat_widgets')
      .insert({
        user_id: user.id,
        name,
        settings: { ...defaultSettings, ...settings },
        allowed_domains: allowed_domains || [],
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: widget }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
