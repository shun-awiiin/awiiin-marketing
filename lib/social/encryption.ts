/**
 * Token Encryption Module
 * AES-256-GCM encryption for secure token storage
 */

import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY

  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set')
  }

  const keyBuffer = Buffer.from(key, 'base64')

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded). ` +
      `Current length: ${keyBuffer.length} bytes`
    )
  }

  return keyBuffer
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string): { encrypted: Buffer; iv: Buffer } {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  return { encrypted, iv }
}

/**
 * Decrypt data encrypted with AES-256-GCM
 */
export function decrypt(encrypted: Buffer, iv: Buffer): string {
  const key = getEncryptionKey()

  if (encrypted.length < TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  const authTag = encrypted.subarray(-TAG_LENGTH)
  const ciphertext = encrypted.subarray(0, -TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Encrypt OAuth tokens for database storage
 * Uses a single IV for both tokens to simplify storage
 */
export function encryptTokens(tokens: {
  accessToken: string
  refreshToken?: string | null
}): {
  accessTokenEncrypted: Buffer
  refreshTokenEncrypted: Buffer | null
  iv: Buffer
} {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  // Encrypt access token
  const accessCipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const accessEncrypted = Buffer.concat([
    accessCipher.update(tokens.accessToken, 'utf8'),
    accessCipher.final(),
    accessCipher.getAuthTag(),
  ])

  // Encrypt refresh token if present
  let refreshEncrypted: Buffer | null = null
  if (tokens.refreshToken) {
    // Derive a different IV for refresh token to maintain security
    const refreshIv = deriveIv(iv, 'refresh')
    const refreshCipher = crypto.createCipheriv(ALGORITHM, key, refreshIv)
    refreshEncrypted = Buffer.concat([
      refreshCipher.update(tokens.refreshToken, 'utf8'),
      refreshCipher.final(),
      refreshCipher.getAuthTag(),
    ])
  }

  return {
    accessTokenEncrypted: accessEncrypted,
    refreshTokenEncrypted: refreshEncrypted,
    iv,
  }
}

/**
 * Decrypt stored tokens
 */
export function decryptTokens(
  accessTokenEncrypted: Buffer,
  refreshTokenEncrypted: Buffer | null,
  iv: Buffer
): {
  accessToken: string
  refreshToken: string | null
} {
  const key = getEncryptionKey()

  // Decrypt access token
  const accessAuthTag = accessTokenEncrypted.subarray(-TAG_LENGTH)
  const accessCiphertext = accessTokenEncrypted.subarray(0, -TAG_LENGTH)
  const accessDecipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  accessDecipher.setAuthTag(accessAuthTag)
  const accessToken = Buffer.concat([
    accessDecipher.update(accessCiphertext),
    accessDecipher.final(),
  ]).toString('utf8')

  // Decrypt refresh token if present
  let refreshToken: string | null = null
  if (refreshTokenEncrypted && refreshTokenEncrypted.length > TAG_LENGTH) {
    const refreshIv = deriveIv(iv, 'refresh')
    const refreshAuthTag = refreshTokenEncrypted.subarray(-TAG_LENGTH)
    const refreshCiphertext = refreshTokenEncrypted.subarray(0, -TAG_LENGTH)
    const refreshDecipher = crypto.createDecipheriv(ALGORITHM, key, refreshIv)
    refreshDecipher.setAuthTag(refreshAuthTag)
    refreshToken = Buffer.concat([
      refreshDecipher.update(refreshCiphertext),
      refreshDecipher.final(),
    ]).toString('utf8')
  }

  return { accessToken, refreshToken }
}

/**
 * Derive a secondary IV from the primary IV
 * Used to ensure different IVs for access and refresh tokens
 */
function deriveIv(primaryIv: Buffer, purpose: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(primaryIv)
    .update(purpose)
    .digest()
    .subarray(0, IV_LENGTH)
}

/**
 * Generate a cryptographically secure OAuth state parameter
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate PKCE code verifier and challenge
 * Used for OAuth 2.0 Authorization Code Flow with PKCE
 */
export function generatePKCE(): {
  codeVerifier: string
  codeChallenge: string
} {
  // Generate a random code verifier (43-128 characters)
  const codeVerifier = crypto.randomBytes(32).toString('base64url')

  // Generate the code challenge using S256 method
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return { codeVerifier, codeChallenge }
}

/**
 * Generate a secure random token for various purposes
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash a value for comparison (e.g., webhook signatures)
 */
export function hmacSha256(data: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
}

/**
 * Verify HMAC signature (timing-safe comparison)
 */
export function verifyHmacSignature(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = hmacSha256(data, secret)

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Generate a new encryption key (for setup/rotation)
 * Returns a base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64')
}
