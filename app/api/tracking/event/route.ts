import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordConversionEventSchema } from '@/lib/types/tracking'
import { recordConversionEvent } from '@/lib/tracking/event-recorder'

// This endpoint is called from client-side tracking script
// It needs to support both authenticated and unauthenticated requests

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = recordConversionEventSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Get user_id from request or from tracking link/funnel
    let userId: string | null = null

    const supabase = await createClient()

    // Try to get user from auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      userId = user.id
    }

    // If no user, try to infer from funnel_id or step_id
    if (!userId && validation.data.funnel_id) {
      const { data: funnel } = await supabase
        .from('funnels')
        .select('user_id')
        .eq('id', validation.data.funnel_id)
        .single()

      if (funnel) {
        userId = funnel.user_id
      }
    }

    // If still no user, try to infer from page_url (match against landing pages)
    if (!userId && validation.data.page_url) {
      try {
        const url = new URL(validation.data.page_url)
        const pathParts = url.pathname.split('/')

        // Check if it's an LP URL (/lp/[slug])
        if (pathParts[1] === 'lp' && pathParts[2]) {
          const { data: lp } = await supabase
            .from('landing_pages')
            .select('user_id')
            .eq('slug', pathParts[2])
            .single()

          if (lp) {
            userId = lp.user_id
          }
        }
      } catch {
        // Invalid URL, ignore
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'トラッキング対象が特定できません' },
        { status: 400 }
      )
    }

    // Record the event
    const result = await recordConversionEvent(
      userId,
      validation.data,
      request.headers
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        event_id: result.event_id,
        visitor_id: result.visitor_id,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// Tracking pixel endpoint (1x1 transparent GIF)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventType = searchParams.get('t') || 'page_view'
    const funnelId = searchParams.get('f')
    const stepId = searchParams.get('s')
    const pageUrl = searchParams.get('u')

    // Record the event in the background
    if (funnelId) {
      const supabase = await createClient()

      const { data: funnel } = await supabase
        .from('funnels')
        .select('user_id')
        .eq('id', funnelId)
        .single()

      if (funnel) {
        recordConversionEvent(
          funnel.user_id,
          {
            event_type: eventType as 'page_view' | 'click' | 'opt_in' | 'purchase' | 'upsell_accepted' | 'upsell_declined',
            funnel_id: funnelId,
            step_id: stepId || undefined,
            page_url: pageUrl || undefined,
          },
          request.headers
        ).catch(() => {
          // Ignore errors for pixel tracking
        })
      }
    }

    // Return 1x1 transparent GIF
    const gif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )

    return new NextResponse(gif, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch {
    // Return empty GIF even on error
    const gif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )
    return new NextResponse(gif, {
      headers: { 'Content-Type': 'image/gif' },
    })
  }
}
