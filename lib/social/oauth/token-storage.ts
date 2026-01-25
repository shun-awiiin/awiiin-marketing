/**
 * Token Storage Service
 * Handles encrypted storage and retrieval of OAuth tokens
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encryptTokens, decryptTokens } from '../encryption'
import type { SocialProvider, SocialAccount, SocialAccountWithTokens, OAuthTokens } from '../types'

/**
 * Store OAuth tokens for a new social account
 */
export async function storeAccountTokens(
  userId: string,
  platform: SocialProvider,
  providerAccountId: string,
  tokens: OAuthTokens,
  accountInfo: {
    displayName?: string | null
    username?: string | null
    profileImageUrl?: string | null
  },
  metadata?: Record<string, unknown>
): Promise<SocialAccount> {
  const supabase = await createClient()

  const { accessTokenEncrypted, refreshTokenEncrypted, iv } = encryptTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || null,
  })

  const { data, error } = await supabase
    .from('social_accounts')
    .upsert(
      {
        user_id: userId,
        provider: platform,
        provider_account_id: providerAccountId,
        display_name: accountInfo.displayName || null,
        username: accountInfo.username || null,
        profile_image_url: accountInfo.profileImageUrl || null,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_iv: iv,
        token_expires_at: tokens.expiresAt?.toISOString() || null,
        scopes: tokens.scopes,
        status: 'active',
        metadata: metadata || {},
        last_validated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider,provider_account_id',
      }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to store account tokens: ${error.message}`)
  }

  return mapAccountFromDb(data)
}

/**
 * Get account with decrypted tokens
 */
export async function getAccountWithTokens(
  accountId: string,
  userId?: string
): Promise<SocialAccountWithTokens | null> {
  const supabase = await createClient()

  let query = supabase
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return null
  }

  const { accessToken, refreshToken } = decryptTokens(
    Buffer.from(data.access_token_encrypted),
    data.refresh_token_encrypted ? Buffer.from(data.refresh_token_encrypted) : null,
    Buffer.from(data.token_iv)
  )

  return {
    ...mapAccountFromDb(data),
    accessToken,
    refreshToken,
  }
}

/**
 * Get all accounts for a user (without tokens)
 */
export async function getUserAccounts(
  userId: string,
  platform?: SocialProvider
): Promise<SocialAccount[]> {
  const supabase = await createClient()

  let query = supabase
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (platform) {
    query = query.eq('provider', platform)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to get user accounts: ${error.message}`)
  }

  return (data || []).map(mapAccountFromDb)
}

/**
 * Get account by provider and provider account ID
 */
export async function getAccountByProvider(
  userId: string,
  platform: SocialProvider,
  providerAccountId: string
): Promise<SocialAccount | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', platform)
    .eq('provider_account_id', providerAccountId)
    .single()

  if (error || !data) {
    return null
  }

  return mapAccountFromDb(data)
}

/**
 * Update tokens for an existing account
 */
export async function updateAccountTokens(
  accountId: string,
  tokens: {
    accessToken: string
    refreshToken?: string | null
    expiresAt?: Date | null
  }
): Promise<void> {
  const supabase = await createServiceClient()

  const { accessTokenEncrypted, refreshTokenEncrypted, iv } = encryptTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || null,
  })

  const { error } = await supabase
    .from('social_accounts')
    .update({
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_iv: iv,
      token_expires_at: tokens.expiresAt?.toISOString() || null,
      status: 'active',
      error_message: null,
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  if (error) {
    throw new Error(`Failed to update account tokens: ${error.message}`)
  }
}

/**
 * Update account status
 */
export async function updateAccountStatus(
  accountId: string,
  status: 'active' | 'inactive' | 'expired' | 'revoked',
  errorMessage?: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('social_accounts')
    .update({
      status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  if (error) {
    throw new Error(`Failed to update account status: ${error.message}`)
  }
}

/**
 * Delete a social account
 */
export async function deleteAccount(
  accountId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('social_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete account: ${error.message}`)
  }
}

/**
 * Get accounts with expiring tokens (for proactive refresh)
 */
export async function getAccountsWithExpiringTokens(
  minutesUntilExpiry: number = 30
): Promise<SocialAccountWithTokens[]> {
  const supabase = await createServiceClient()

  const expiryThreshold = new Date(
    Date.now() + minutesUntilExpiry * 60 * 1000
  ).toISOString()

  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('status', 'active')
    .not('token_expires_at', 'is', null)
    .lt('token_expires_at', expiryThreshold)

  if (error) {
    throw new Error(`Failed to get expiring accounts: ${error.message}`)
  }

  return (data || []).map((account) => {
    const { accessToken, refreshToken } = decryptTokens(
      Buffer.from(account.access_token_encrypted),
      account.refresh_token_encrypted ? Buffer.from(account.refresh_token_encrypted) : null,
      Buffer.from(account.token_iv)
    )

    return {
      ...mapAccountFromDb(account),
      accessToken,
      refreshToken,
    }
  })
}

/**
 * Map database row to SocialAccount type
 */
function mapAccountFromDb(data: Record<string, unknown>): SocialAccount {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    provider: data.provider as SocialProvider,
    providerAccountId: data.provider_account_id as string,
    displayName: (data.display_name as string) || null,
    username: (data.username as string) || null,
    profileImageUrl: (data.profile_image_url as string) || null,
    scopes: (data.scopes as string[]) || [],
    status: data.status as 'active' | 'inactive' | 'expired' | 'revoked',
    tokenExpiresAt: data.token_expires_at
      ? new Date(data.token_expires_at as string)
      : null,
    lastValidatedAt: data.last_validated_at
      ? new Date(data.last_validated_at as string)
      : null,
    errorMessage: (data.error_message as string) || null,
    metadata: (data.metadata as Record<string, unknown>) || {},
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  }
}
