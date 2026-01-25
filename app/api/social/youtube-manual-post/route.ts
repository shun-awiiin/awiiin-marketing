import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const LogEventSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_type: z.enum(['SEMINAR_INVITE', 'FREE_TRIAL_INVITE']),
  event_type: z.enum([
    'youtube_manual_copy',
    'youtube_manual_studio_opened',
    'youtube_manual_posted',
  ]),
  generated_text: z.string().min(1).max(5000),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = LogEventSchema.parse(body)

    // Record event in social_events table
    const { error } = await supabase.from('social_events').insert({
      user_id: user.id,
      provider: 'youtube',
      event_type: validatedData.event_type,
      payload: {
        campaign_id: validatedData.campaign_id,
        campaign_type: validatedData.campaign_type,
        generated_text: validatedData.generated_text,
        timestamp: new Date().toISOString(),
      },
      occurred_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: 'ログの保存に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '入力データが不正です' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// Get YouTube manual post history for a campaign
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'campaign_idが必要です' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('social_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'youtube')
      .contains('payload', { campaign_id: campaignId })
      .order('occurred_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json(
        { success: false, error: '履歴の取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
