import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordLinkClick } from '@/lib/tracking/event-recorder'
import { extractVisitorInfo, generateFingerprint, getCookieValue, createCookieHeader, VISITOR_COOKIE, REFERRER_COOKIE } from '@/lib/tracking/fingerprint'
import { buildUrlWithUtm } from '@/lib/tracking/utm-parser'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabase = await createClient()

    // Find the tracking link
    const { data: link, error } = await supabase
      .from('tracking_links')
      .select('*')
      .eq('short_code', code)
      .eq('status', 'active')
      .single()

    if (error || !link) {
      // Redirect to home if link not found
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Check if link is expired
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Extract visitor info
    const visitorInfo = extractVisitorInfo(request.headers)
    const cookieHeader = request.headers.get('cookie')
    const existingVisitorId = getCookieValue(cookieHeader, VISITOR_COOKIE.name)

    // Generate fingerprint for visitor tracking
    const fingerprint = generateFingerprint({
      ip_address: visitorInfo.ip_address || undefined,
      user_agent: visitorInfo.user_agent || undefined,
      accept_language: visitorInfo.accept_language || undefined,
    })

    // Record the click (async, don't wait)
    recordLinkClick(link.id, {
      visitor_id: existingVisitorId || undefined,
      ip_address: visitorInfo.ip_address || undefined,
      user_agent: visitorInfo.user_agent || undefined,
      referer: visitorInfo.referer || undefined,
    }).catch(() => {
      // Ignore errors to not delay redirect
    })

    // Build destination URL with UTM parameters
    const destinationUrl = buildUrlWithUtm(link.destination_url, {
      source: link.utm_source,
      medium: link.utm_medium,
      campaign: link.utm_campaign,
      content: link.utm_content,
      term: link.utm_term,
    })

    // Create response with redirect
    const response = NextResponse.redirect(destinationUrl, 302)

    // Set visitor cookie if not exists
    if (!existingVisitorId) {
      response.headers.set(
        'Set-Cookie',
        createCookieHeader(VISITOR_COOKIE.name, fingerprint, {
          maxAge: VISITOR_COOKIE.maxAge,
          path: '/',
          sameSite: 'Lax',
        })
      )
    }

    // Set referrer cookie if affiliate code exists
    const refCode = request.nextUrl.searchParams.get('ref')
    if (refCode) {
      response.headers.append(
        'Set-Cookie',
        createCookieHeader(REFERRER_COOKIE.name, refCode, {
          maxAge: REFERRER_COOKIE.maxAge,
          path: '/',
          sameSite: 'Lax',
        })
      )
    }

    return response
  } catch (error) {
    // On any error, redirect to home
    return NextResponse.redirect(new URL('/', request.url))
  }
}
