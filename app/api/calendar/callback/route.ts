/**
 * GET /api/calendar/callback
 * Handles Google OAuth callback, stores encrypted tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  exchangeCodeForTokens,
  getGoogleUserEmail,
} from '@/lib/calendar/google-client'
import { encrypt } from '@/lib/calendar/encryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // Handle user denying access
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/calendar/settings?error=access_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/calendar/settings?error=missing_params`
    )
  }

  // Validate state
  const savedState = request.cookies.get('calendar_oauth_state')?.value
  const userId = request.cookies.get('calendar_oauth_user')?.value

  if (!savedState || savedState !== state || !userId) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/calendar/settings?error=invalid_state`
    )
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${baseUrl}/dashboard/calendar/settings?error=no_refresh_token`
      )
    }

    // Get the Google account email
    const googleEmail = await getGoogleUserEmail(tokens.access_token)

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokens.access_token)
    const refreshTokenEncrypted = encrypt(tokens.refresh_token)
    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString()

    // Store connection in DB
    const supabase = await createServiceClient()

    // Delete existing connection for this user, then insert fresh
    await supabase
      .from('calendar_connections')
      .delete()
      .eq('user_id', userId)

    const { error: dbError } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: userId,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        calendar_id: 'primary',
        sync_enabled: true,
        google_email: googleEmail,
      })

    if (dbError) {
      return NextResponse.redirect(
        `${baseUrl}/dashboard/calendar/settings?error=db_error&detail=${encodeURIComponent(dbError.message)}`
      )
    }

    // Clear OAuth cookies
    const response = NextResponse.redirect(
      `${baseUrl}/dashboard/calendar/settings?success=connected`
    )
    response.cookies.delete('calendar_oauth_state')
    response.cookies.delete('calendar_oauth_user')

    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(
      `${baseUrl}/dashboard/calendar/settings?error=token_exchange_failed&detail=${encodeURIComponent(msg)}`
    )
  }
}
