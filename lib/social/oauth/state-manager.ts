/**
 * OAuth State Manager
 * Handles CSRF protection and PKCE for OAuth flows
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateOAuthState, generatePKCE } from '../encryption'
import type { SocialProvider, OAuthState } from '../types'

const STATE_EXPIRY_MINUTES = 10

/**
 * Create and store an OAuth state for CSRF protection
 */
export async function createOAuthState(
  userId: string,
  platform: SocialProvider,
  redirectUri: string,
  usePKCE: boolean = false
): Promise<{
  state: string
  codeVerifier?: string
  codeChallenge?: string
}> {
  const supabase = await createClient()

  const state = generateOAuthState()
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000)

  let codeVerifier: string | undefined
  let codeChallenge: string | undefined

  if (usePKCE) {
    const pkce = generatePKCE()
    codeVerifier = pkce.codeVerifier
    codeChallenge = pkce.codeChallenge
  }

  const { error } = await supabase.from('oauth_states').insert({
    user_id: userId,
    platform,
    state,
    code_verifier: codeVerifier || null,
    redirect_uri: redirectUri,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    throw new Error(`Failed to create OAuth state: ${error.message}`)
  }

  return {
    state,
    codeVerifier,
    codeChallenge,
  }
}

/**
 * Validate and consume an OAuth state
 * Returns the state data if valid, throws if invalid/expired
 */
export async function validateOAuthState(
  state: string
): Promise<OAuthState> {
  const supabase = await createClient()

  // Fetch the state
  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .single()

  if (error || !data) {
    throw new Error('Invalid OAuth state')
  }

  // Check expiration
  if (new Date(data.expires_at) < new Date()) {
    // Delete expired state
    await supabase.from('oauth_states').delete().eq('id', data.id)
    throw new Error('OAuth state has expired')
  }

  // Delete the state (one-time use)
  await supabase.from('oauth_states').delete().eq('id', data.id)

  return {
    id: data.id,
    userId: data.user_id,
    platform: data.platform as SocialProvider,
    state: data.state,
    codeVerifier: data.code_verifier || undefined,
    redirectUri: data.redirect_uri,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  }
}

/**
 * Get OAuth state without consuming it (for verification)
 */
export async function getOAuthState(state: string): Promise<OAuthState | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .single()

  if (error || !data) {
    return null
  }

  // Check expiration
  if (new Date(data.expires_at) < new Date()) {
    return null
  }

  return {
    id: data.id,
    userId: data.user_id,
    platform: data.platform as SocialProvider,
    state: data.state,
    codeVerifier: data.code_verifier || undefined,
    redirectUri: data.redirect_uri,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  }
}

/**
 * Clean up expired OAuth states
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredStates(): Promise<number> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase.rpc('cleanup_expired_oauth_states')

  if (error) {
    throw new Error(`Failed to cleanup OAuth states: ${error.message}`)
  }

  return data as number
}

/**
 * Delete all OAuth states for a user (e.g., on logout)
 */
export async function deleteUserOAuthStates(userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('oauth_states')
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete user OAuth states: ${error.message}`)
  }
}

/**
 * Check if a state exists and is valid (without consuming)
 */
export async function isStateValid(state: string): Promise<boolean> {
  const stateData = await getOAuthState(state)
  return stateData !== null
}

/**
 * Build OAuth authorization URL with all required parameters
 */
export function buildAuthorizationUrl(
  baseUrl: string,
  params: {
    clientId: string
    redirectUri: string
    scope: string
    state: string
    codeChallenge?: string
    codeChallengeMethod?: string
    responseType?: string
    accessType?: string
    prompt?: string
  }
): string {
  const url = new URL(baseUrl)

  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', params.responseType || 'code')
  url.searchParams.set('scope', params.scope)
  url.searchParams.set('state', params.state)

  if (params.codeChallenge) {
    url.searchParams.set('code_challenge', params.codeChallenge)
    url.searchParams.set('code_challenge_method', params.codeChallengeMethod || 'S256')
  }

  if (params.accessType) {
    url.searchParams.set('access_type', params.accessType)
  }

  if (params.prompt) {
    url.searchParams.set('prompt', params.prompt)
  }

  return url.toString()
}

/**
 * Exchange authorization code for tokens
 * Generic implementation that can be used by all providers
 */
export async function exchangeCodeForTokens(
  tokenUrl: string,
  params: {
    code: string
    clientId: string
    clientSecret: string
    redirectUri: string
    codeVerifier?: string
    grantType?: string
  }
): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
  tokenType?: string
}> {
  const body = new URLSearchParams({
    grant_type: params.grantType || 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
  })

  // Add client secret (some providers require it in body, others in header)
  if (params.clientSecret) {
    body.set('client_secret', params.clientSecret)
  }

  // Add PKCE code verifier if present
  if (params.codeVerifier) {
    body.set('code_verifier', params.codeVerifier)
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`
    )
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  }
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  tokenUrl: string,
  params: {
    refreshToken: string
    clientId: string
    clientSecret: string
  }
): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  })

  if (params.clientSecret) {
    body.set('client_secret', params.clientSecret)
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Token refresh failed: ${errorData.error_description || errorData.error || response.statusText}`
    )
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}
