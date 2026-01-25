import { createHash } from 'crypto'

/**
 * Generate a short code for tracking links
 */
export function generateShortCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  const randomBytes = new Uint8Array(length)

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes)
  } else {
    for (let i = 0; i < length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length]
  }

  return result
}

/**
 * Generate a cookie ID for visitor tracking
 */
export function generateCookieId(): string {
  const timestamp = Date.now().toString(36)
  const random = generateShortCode(12)
  return `${timestamp}_${random}`
}

/**
 * Generate a visitor fingerprint from request data
 * This is a simple fingerprint based on available server-side data
 */
export function generateFingerprint(data: {
  ip_address?: string
  user_agent?: string
  accept_language?: string
}): string {
  const components = [
    data.ip_address || '',
    data.user_agent || '',
    data.accept_language || '',
  ]

  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex')

  return hash.substring(0, 32)
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = generateShortCode(8)
  return `sess_${timestamp}_${random}`
}

/**
 * Extract visitor info from request headers
 */
export function extractVisitorInfo(headers: Headers): {
  ip_address: string | null
  user_agent: string | null
  accept_language: string | null
  referer: string | null
} {
  // Try multiple headers for IP address (handles proxies)
  const ip_address =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    null

  return {
    ip_address,
    user_agent: headers.get('user-agent'),
    accept_language: headers.get('accept-language'),
    referer: headers.get('referer'),
  }
}

/**
 * Parse cookie header and extract a specific cookie value
 */
export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map(c => c.trim())
  for (const cookie of cookies) {
    const [cookieName, ...cookieValue] = cookie.split('=')
    if (cookieName === name) {
      return cookieValue.join('=')
    }
  }

  return null
}

/**
 * Create a Set-Cookie header value
 */
export function createCookieHeader(
  name: string,
  value: string,
  options: {
    maxAge?: number
    path?: string
    domain?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
  } = {}
): string {
  const parts = [`${name}=${value}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  parts.push(`Path=${options.path || '/'}`)

  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }

  if (options.secure !== false) {
    parts.push('Secure')
  }

  if (options.httpOnly !== false) {
    parts.push('HttpOnly')
  }

  parts.push(`SameSite=${options.sameSite || 'Lax'}`)

  return parts.join('; ')
}

/**
 * Visitor tracking cookie configuration
 */
export const VISITOR_COOKIE = {
  name: '_vid',
  maxAge: 365 * 24 * 60 * 60, // 1 year
} as const

export const REFERRER_COOKIE = {
  name: '_ref',
  maxAge: 30 * 24 * 60 * 60, // 30 days
} as const

export const SESSION_COOKIE = {
  name: '_sid',
  maxAge: 30 * 60, // 30 minutes
} as const
