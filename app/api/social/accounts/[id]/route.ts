/**
 * Individual Social Account API
 * GET - Get account details
 * PATCH - Update account settings
 * DELETE - Disconnect account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAccountWithTokens,
  updateAccountStatus,
  deleteAccount,
} from '@/lib/social/oauth/token-storage'
import { adapterRegistry } from '@/lib/social/adapters/interface'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/social/accounts/[id]
 * Get account details with validation status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const account = await getAccountWithTokens(id, user.id)

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'アカウントが見つかりません' },
        { status: 404 }
      )
    }

    // Validate credentials if requested
    const { searchParams } = new URL(request.url)
    const validate = searchParams.get('validate') === 'true'

    let validationResult = null
    if (validate && adapterRegistry.supports(account.provider)) {
      const adapter = adapterRegistry.create(account.provider, account, {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
      })
      validationResult = await adapter.validateCredentials()
    }

    // Remove sensitive fields
    const safeAccount = {
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
      validation: validationResult,
    }

    return NextResponse.json({
      success: true,
      data: safeAccount,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'アカウント取得に失敗しました',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/social/accounts/[id]
 * Update account status or settings
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status } = body as { status?: 'active' | 'inactive' }

    // Verify ownership
    const account = await getAccountWithTokens(id, user.id)
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'アカウントが見つかりません' },
        { status: 404 }
      )
    }

    if (status) {
      await updateAccountStatus(id, status)
    }

    return NextResponse.json({
      success: true,
      data: { id, status },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'アカウント更新に失敗しました',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/social/accounts/[id]
 * Disconnect (delete) a social account
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    await deleteAccount(id, user.id)

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'アカウント削除に失敗しました',
      },
      { status: 500 }
    )
  }
}
