import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LineClient, buildTextMessage } from '@/lib/line/line-client'
import { sendLineTestMessageSchema } from '@/lib/validation/l-step'

// POST /api/line/accounts/[id]/test - Send test message
export async function POST(
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

    const body = await request.json()
    const validation = sendLineTestMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { line_user_id, message } = validation.data

    // Get account
    const { data: account } = await supabase
      .from('line_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!account) {
      return NextResponse.json({ success: false, error: 'アカウントが見つかりません' }, { status: 404 })
    }

    try {
      const client = new LineClient(account.access_token, account.channel_secret)
      await client.pushMessage(line_user_id, [buildTextMessage(message)])

      return NextResponse.json({ success: true, message: 'テストメッセージを送信しました' })
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `送信に失敗しました: ${err}`
      }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
