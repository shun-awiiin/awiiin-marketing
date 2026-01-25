/**
 * YouTube OAuth Callback
 * Handles Google OAuth 2.0 + PKCE callback
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOAuthState, exchangeCodeForTokens } from '@/lib/social/oauth/state-manager'
import { storeAccountTokens } from '@/lib/social/oauth/token-storage'
import { getOAuthConfig } from '@/lib/social/adapters/interface'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * GET /api/social/oauth/youtube/callback
 * Handle OAuth callback from Google for YouTube
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
    // Validate state
    const stateData = await validateOAuthState(state)

    if (stateData.platform !== 'youtube') {
      return NextResponse.redirect(`${errorUrl}${encodeURIComponent('無効なプラットフォーム状態')}`)
    }

    // Get OAuth config
    const config = getOAuthConfig('youtube')

    // Exchange code for tokens (with PKCE if used)
    const tokens = await exchangeCodeForTokens(config.tokenUrl, {
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: stateData.redirectUri,
      codeVerifier: stateData.codeVerifier,
    })

    // Get YouTube channel info
    const channelResponse = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet&mine=true`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    )

    if (!channelResponse.ok) {
      throw new Error('YouTubeチャンネル情報の取得に失敗しました')
    }

    const channelData = await channelResponse.json()
    const channel = channelData.items?.[0]

    if (!channel) {
      throw new Error('YouTubeチャンネルが見つかりません。チャンネルを作成してから再接続してください。')
    }

    // Store account
    await storeAccountTokens(
      stateData.userId,
      'youtube',
      channel.id,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : undefined,
        scopes: config.scopes,
      },
      {
        displayName: channel.snippet.title,
        username: channel.snippet.customUrl || channel.id,
        profileImageUrl: channel.snippet.thumbnails?.default?.url,
      }
    )

    return NextResponse.redirect(`${dashboardUrl}?connected=youtube`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth処理に失敗しました'
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent(message)}`)
  }
}
