import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectLineAccountSchema } from '@/lib/validation/l-step'

// GET /api/line/accounts - List LINE accounts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('line_accounts')
      .select('id, channel_id, bot_basic_id, display_name, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/line/accounts - Connect LINE account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = connectLineAccountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Test connection by getting bot info
    try {
      const response = await fetch('https://api.line.me/v2/bot/info', {
        headers: {
          'Authorization': `Bearer ${validation.data.access_token}`
        }
      })

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: 'LINE APIへの接続に失敗しました。認証情報を確認してください。'
        }, { status: 400 })
      }

      const botInfo = await response.json()

      const { data, error } = await supabase
        .from('line_accounts')
        .insert({
          user_id: user.id,
          channel_id: validation.data.channel_id,
          channel_secret: validation.data.channel_secret,
          access_token: validation.data.access_token,
          bot_basic_id: botInfo.basicId,
          display_name: botInfo.displayName,
          status: 'active'
        })
        .select('id, channel_id, bot_basic_id, display_name, status, created_at')
        .single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({
            success: false,
            error: 'このチャンネルは既に連携されています'
          }, { status: 400 })
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, data }, { status: 201 })
    } catch {
      return NextResponse.json({
        success: false,
        error: 'LINE APIへの接続に失敗しました'
      }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
