/**
 * WhatsApp OAuth Callback
 * Handles Facebook OAuth flow to get WhatsApp Business Account access
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOAuthState, exchangeCodeForTokens } from '@/lib/social/oauth/state-manager'
import { storeAccountTokens } from '@/lib/social/oauth/token-storage'
import { getOAuthConfig } from '@/lib/social/adapters/interface'

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'

/**
 * GET /api/social/oauth/whatsapp/callback
 * Handle OAuth callback from Facebook for WhatsApp Business
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

    if (stateData.platform !== 'whatsapp') {
      return NextResponse.redirect(`${errorUrl}${encodeURIComponent('無効なプラットフォーム状態')}`)
    }

    // Get OAuth config
    const config = getOAuthConfig('whatsapp')

    // Exchange code for token
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
    const expiresIn = longLivedData.expires_in || 5184000

    // Get WhatsApp Business Accounts
    const wabaResponse = await fetch(
      `${GRAPH_API_BASE}/me/businesses?access_token=${longLivedToken}`
    )

    if (!wabaResponse.ok) {
      throw new Error('WhatsAppビジネスアカウントの取得に失敗しました')
    }

    const wabaData = await wabaResponse.json()
    const businesses = wabaData.data || []

    if (businesses.length === 0) {
      throw new Error('WhatsApp Businessアカウントが見つかりません')
    }

    // Get WhatsApp phone number from first business
    let phoneNumberId = null
    let phoneNumber = null
    let businessAccountId = null

    for (const business of businesses) {
      const phoneResponse = await fetch(
        `${GRAPH_API_BASE}/${business.id}/phone_numbers?access_token=${longLivedToken}`
      )

      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json()
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id
          phoneNumber = phoneData.data[0].display_phone_number
          businessAccountId = business.id
          break
        }
      }
    }

    if (!phoneNumberId) {
      throw new Error('WhatsApp電話番号が設定されていません。WhatsApp Business Managerで設定してください。')
    }

    // Store account
    await storeAccountTokens(
      stateData.userId,
      'whatsapp',
      phoneNumberId,
      {
        accessToken: longLivedToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scopes: config.scopes,
      },
      {
        displayName: 'WhatsApp Business',
        username: phoneNumber,
      },
      {
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
        display_phone_number: phoneNumber,
      }
    )

    return NextResponse.redirect(`${dashboardUrl}?connected=whatsapp`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth処理に失敗しました'
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent(message)}`)
  }
}
