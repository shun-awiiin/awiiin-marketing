/**
 * GET /api/calendar/auth
 * Redirects to Google OAuth consent screen for Calendar access.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthUrl } from '@/lib/calendar/google-client'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // Generate state token to prevent CSRF
  const state = randomBytes(32).toString('hex')

  // Store state in a short-lived cookie for validation in callback
  const oauthUrl = getGoogleOAuthUrl(state)

  const response = NextResponse.redirect(oauthUrl)
  response.cookies.set('calendar_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })
  response.cookies.set('calendar_oauth_user', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
