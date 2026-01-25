/**
 * Social Accounts API
 * GET - List connected social accounts
 * POST - Initiate OAuth connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccounts } from '@/lib/social/oauth/token-storage'
import { createOAuthState, buildAuthorizationUrl } from '@/lib/social/oauth/state-manager'
import { getOAuthConfig } from '@/lib/social/adapters/interface'
import type { SocialProvider } from '@/lib/social/types'

const VALID_PROVIDERS: SocialProvider[] = ['x', 'instagram', 'youtube', 'whatsapp']

/**
 * GET /api/social/accounts
 * List all connected social accounts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') as SocialProvider | null

    const accounts = await getUserAccounts(user.id, platform || undefined)

    // Remove sensitive fields
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      displayName: account.displayName,
      username: account.username,
      profileImageUrl: account.profileImageUrl,
      status: account.status,
      scopes: account.scopes,
      tokenExpiresAt: account.tokenExpiresAt,
      lastValidatedAt: account.lastValidatedAt,
      errorMessage: account.errorMessage,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data: safeAccounts,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'アカウント一覧の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/social/accounts
 * Initiate OAuth connection for a platform
 *
 * Request body:
 * {
 *   platform: 'x' | 'instagram' | 'youtube' | 'whatsapp'
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     authorizationUrl: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { platform } = body as { platform: SocialProvider }

    if (!platform || !VALID_PROVIDERS.includes(platform)) {
      return NextResponse.json(
        { success: false, error: '無効なプラットフォームです' },
        { status: 400 }
      )
    }

    // Get OAuth configuration for the platform
    const config = getOAuthConfig(platform)

    if (!config.clientId) {
      return NextResponse.json(
        { success: false, error: `${platform}のOAuth設定が構成されていません` },
        { status: 500 }
      )
    }

    // Build callback URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    const redirectUri = `${baseUrl}/api/social/oauth/${platform}/callback`

    // Create OAuth state with PKCE if required
    const stateResult = await createOAuthState(
      user.id,
      platform,
      redirectUri,
      config.usePKCE
    )

    // Build authorization URL
    const authorizationUrl = buildAuthorizationUrl(config.authorizationUrl, {
      clientId: config.clientId,
      redirectUri,
      scope: config.scopes.join(' '),
      state: stateResult.state,
      codeChallenge: stateResult.codeChallenge,
      codeChallengeMethod: config.usePKCE ? 'S256' : undefined,
      responseType: 'code',
      accessType: platform === 'youtube' ? 'offline' : undefined,
      prompt: platform === 'youtube' ? 'consent' : undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth開始に失敗しました',
      },
      { status: 500 }
    )
  }
}
