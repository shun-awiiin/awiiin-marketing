/**
 * X (Twitter) OAuth Callback
 * Handles OAuth 2.0 + PKCE callback from Twitter
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOAuthState, exchangeCodeForTokens } from '@/lib/social/oauth/state-manager'
import { storeAccountTokens } from '@/lib/social/oauth/token-storage'
import { getOAuthConfig } from '@/lib/social/adapters/interface'

const X_API_BASE = 'https://api.twitter.com/2'

/**
 * GET /api/social/oauth/x/callback
 * Handle OAuth callback from X (Twitter)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
  const dashboardUrl = `${baseUrl}/dashboard/social/accounts`
  const errorUrl = `${baseUrl}/dashboard/social/accounts?error=`

  // Handle OAuth errors
  if (error) {
    const message = errorDescription || error
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent(message)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent('認証コードまたは状態が不足しています')}`)
  }

  try {
    // Validate state (CSRF protection)
    const stateData = await validateOAuthState(state)

    if (stateData.platform !== 'x') {
      return NextResponse.redirect(`${errorUrl}${encodeURIComponent('無効なプラットフォーム状態')}`)
    }

    // Get OAuth config
    const config = getOAuthConfig('x')

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(config.tokenUrl, {
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: stateData.redirectUri,
      codeVerifier: stateData.codeVerifier,
    })

    // Fetch user info
    const userResponse = await fetch(
      `${X_API_BASE}/users/me?user.fields=profile_image_url,username,name`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    )

    if (!userResponse.ok) {
      throw new Error('ユーザー情報の取得に失敗しました')
    }

    const userData = await userResponse.json()
    const user = userData.data

    // Store account with encrypted tokens
    await storeAccountTokens(
      stateData.userId,
      'x',
      user.id,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : undefined,
        scopes: config.scopes,
      },
      {
        displayName: user.name,
        username: user.username,
        profileImageUrl: user.profile_image_url,
      }
    )

    // Redirect to success page
    return NextResponse.redirect(`${dashboardUrl}?connected=x`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth処理に失敗しました'
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent(message)}`)
  }
}
