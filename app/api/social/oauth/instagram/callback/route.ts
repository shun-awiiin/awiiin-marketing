/**
 * Instagram OAuth Callback
 * Handles Facebook OAuth flow to get Instagram Business Account access
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOAuthState, exchangeCodeForTokens } from '@/lib/social/oauth/state-manager'
import { storeAccountTokens } from '@/lib/social/oauth/token-storage'
import { getOAuthConfig } from '@/lib/social/adapters/interface'

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'

/**
 * GET /api/social/oauth/instagram/callback
 * Handle OAuth callback from Facebook for Instagram
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

    if (stateData.platform !== 'instagram') {
      return NextResponse.redirect(`${errorUrl}${encodeURIComponent('無効なプラットフォーム状態')}`)
    }

    // Get OAuth config
    const config = getOAuthConfig('instagram')

    // Exchange code for short-lived token
    const tokens = await exchangeCodeForTokens(config.tokenUrl, {
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: stateData.redirectUri,
    })

    // Exchange for long-lived token
    const longLivedResponse = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.clientId}&client_secret=${config.clientSecret}&fb_exchange_token=${tokens.accessToken}`
    )

    if (!longLivedResponse.ok) {
      throw new Error('長期トークンの取得に失敗しました')
    }

    const longLivedData = await longLivedResponse.json()
    const longLivedToken = longLivedData.access_token
    const expiresIn = longLivedData.expires_in || 5184000 // ~60 days

    // Get Facebook Pages the user manages
    const pagesResponse = await fetch(
      `${GRAPH_API_BASE}/me/accounts?access_token=${longLivedToken}`
    )

    if (!pagesResponse.ok) {
      throw new Error('Facebookページの取得に失敗しました')
    }

    const pagesData = await pagesResponse.json()
    const pages = pagesData.data || []

    if (pages.length === 0) {
      throw new Error('管理しているFacebookページがありません。Instagram Business Accountを接続するにはFacebookページが必要です。')
    }

    // Find Instagram Business Account connected to any page
    let instagramAccount = null
    let pageAccessToken = null

    for (const page of pages) {
      const igResponse = await fetch(
        `${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      )

      if (igResponse.ok) {
        const igData = await igResponse.json()
        if (igData.instagram_business_account) {
          instagramAccount = igData.instagram_business_account
          pageAccessToken = page.access_token
          break
        }
      }
    }

    if (!instagramAccount || !pageAccessToken) {
      throw new Error('Instagram Business Accountが見つかりません。FacebookページにInstagramアカウントをリンクしてください。')
    }

    // Get Instagram account details
    const igDetailsResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramAccount.id}?fields=id,username,name,profile_picture_url&access_token=${pageAccessToken}`
    )

    if (!igDetailsResponse.ok) {
      throw new Error('Instagramアカウント情報の取得に失敗しました')
    }

    const igDetails = await igDetailsResponse.json()

    // Store account with page access token (for posting)
    await storeAccountTokens(
      stateData.userId,
      'instagram',
      instagramAccount.id,
      {
        accessToken: pageAccessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scopes: config.scopes,
      },
      {
        displayName: igDetails.name || igDetails.username,
        username: igDetails.username,
        profileImageUrl: igDetails.profile_picture_url,
      },
      {
        instagram_account_id: instagramAccount.id,
        facebook_user_token: longLivedToken,
      }
    )

    return NextResponse.redirect(`${dashboardUrl}?connected=instagram`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth処理に失敗しました'
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent(message)}`)
  }
}
