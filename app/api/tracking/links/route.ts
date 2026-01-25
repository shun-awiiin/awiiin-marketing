import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTrackingLinkSchema } from '@/lib/types/tracking'
import { generateShortCode } from '@/lib/tracking/fingerprint'
import { buildUrlWithUtm } from '@/lib/tracking/utm-parser'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('tracking_links')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: links, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: links,
      meta: {
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = createTrackingLinkSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Generate unique short code
    let shortCode = generateShortCode(8)
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('tracking_links')
        .select('id')
        .eq('short_code', shortCode)
        .single()

      if (!existing) break

      shortCode = generateShortCode(8)
      attempts++
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'ショートコードの生成に失敗しました' },
        { status: 500 }
      )
    }

    const { data: link, error } = await supabase
      .from('tracking_links')
      .insert({
        user_id: user.id,
        name: validation.data.name,
        short_code: shortCode,
        destination_url: validation.data.destination_url,
        utm_source: validation.data.utm_source || null,
        utm_medium: validation.data.utm_medium || null,
        utm_campaign: validation.data.utm_campaign || null,
        utm_content: validation.data.utm_content || null,
        utm_term: validation.data.utm_term || null,
        funnel_id: validation.data.funnel_id || null,
        status: validation.data.status || 'active',
        expires_at: validation.data.expires_at || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Build full tracking URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const trackingUrl = `${baseUrl}/api/t/${shortCode}`

    // Build destination URL with UTM params
    const destinationWithUtm = buildUrlWithUtm(validation.data.destination_url, {
      source: validation.data.utm_source,
      medium: validation.data.utm_medium,
      campaign: validation.data.utm_campaign,
      content: validation.data.utm_content,
      term: validation.data.utm_term,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...link,
        tracking_url: trackingUrl,
        destination_with_utm: destinationWithUtm,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
