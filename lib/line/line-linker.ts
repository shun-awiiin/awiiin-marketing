import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const TOKEN_EXPIRY_HOURS = 24

export interface LinkTokenData {
  id: string
  token: string
  contact_id: string
  line_account_id: string
  expires_at: string
  used_at: string | null
  created_at: string
}

/**
 * Generate a secure random link token
 * Returns a 64-character hex string
 */
export function generateLinkToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Check if a token is still valid based on creation time
 * Tokens are valid for 24 hours
 */
export function isTokenValid(createdAt: Date): boolean {
  const now = new Date()
  const diff = now.getTime() - createdAt.getTime()
  const expiryMs = TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  return diff < expiryMs
}

/**
 * Check if a token is expired based on expiration time
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const now = new Date()
  return now.getTime() >= expiresAt.getTime()
}

/**
 * Verify a link token and return its data if valid
 * Returns null if token doesn't exist, is expired, or already used
 */
export async function verifyToken(
  token: string,
  supabase: SupabaseClient
): Promise<LinkTokenData | null> {
  const { data, error } = await supabase
    .from('link_tokens')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .single()

  if (error || !data) {
    return null
  }

  // Check expiration
  if (isTokenExpired(new Date(data.expires_at))) {
    return null
  }

  return data as LinkTokenData
}

/**
 * Create a new link token for a contact
 */
export async function createLinkToken(
  supabase: SupabaseClient,
  contactId: string,
  lineAccountId: string
): Promise<{ token: string; linkUrl: string }> {
  const token = generateLinkToken()
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  const { error } = await supabase.from('link_tokens').insert({
    token,
    contact_id: contactId,
    line_account_id: lineAccountId,
    expires_at: expiresAt.toISOString()
  })

  if (error) {
    throw new Error(`Failed to create link token: ${error.message}`)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const linkUrl = `${baseUrl}/line/link?token=${token}`

  return { token, linkUrl }
}

/**
 * Consume a link token by marking it as used and linking the contact
 * Returns true if successful, false if token invalid
 */
export async function consumeToken(
  supabase: SupabaseClient,
  token: string,
  lineUserId: string,
  displayName?: string,
  pictureUrl?: string
): Promise<boolean> {
  // Verify token first
  const tokenData = await verifyToken(token, supabase)
  if (!tokenData) {
    return false
  }

  // Start transaction-like operations
  // 1. Mark token as used
  const { error: updateError } = await supabase
    .from('link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenData.id)

  if (updateError) {
    return false
  }

  // 2. Create or update the contact-LINE link
  const { error: linkError } = await supabase
    .from('contact_line_links')
    .upsert(
      {
        contact_id: tokenData.contact_id,
        line_user_id: lineUserId,
        line_account_id: tokenData.line_account_id,
        display_name: displayName,
        picture_url: pictureUrl,
        status: 'active'
      },
      { onConflict: 'contact_id,line_account_id' }
    )

  if (linkError) {
    // Rollback token usage
    await supabase
      .from('link_tokens')
      .update({ used_at: null })
      .eq('id', tokenData.id)
    return false
  }

  return true
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('link_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    return 0
  }

  return data?.length || 0
}
