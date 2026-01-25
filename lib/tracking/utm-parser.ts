import type { UtmParams } from '@/lib/types/tracking'

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/**
 * Parse UTM parameters from URL
 */
export function parseUtmParams(url: string): UtmParams {
  try {
    const urlObj = new URL(url)
    const params: UtmParams = {}

    for (const param of UTM_PARAMS) {
      const value = urlObj.searchParams.get(param)
      if (value) {
        const key = param.replace('utm_', '') as keyof UtmParams
        params[key] = value
      }
    }

    return params
  } catch {
    return {}
  }
}

/**
 * Build URL with UTM parameters
 */
export function buildUrlWithUtm(baseUrl: string, utm: UtmParams): string {
  try {
    const url = new URL(baseUrl)

    if (utm.source) url.searchParams.set('utm_source', utm.source)
    if (utm.medium) url.searchParams.set('utm_medium', utm.medium)
    if (utm.campaign) url.searchParams.set('utm_campaign', utm.campaign)
    if (utm.content) url.searchParams.set('utm_content', utm.content)
    if (utm.term) url.searchParams.set('utm_term', utm.term)

    return url.toString()
  } catch {
    return baseUrl
  }
}

/**
 * Extract UTM parameters from request headers (referer)
 */
export function extractUtmFromReferer(referer: string | null): UtmParams {
  if (!referer) return {}
  return parseUtmParams(referer)
}

/**
 * Merge UTM parameters, preferring newer values
 */
export function mergeUtmParams(existing: UtmParams, incoming: UtmParams): UtmParams {
  return {
    source: incoming.source || existing.source,
    medium: incoming.medium || existing.medium,
    campaign: incoming.campaign || existing.campaign,
    content: incoming.content || existing.content,
    term: incoming.term || existing.term,
  }
}

/**
 * Check if UTM parameters are empty
 */
export function isUtmEmpty(utm: UtmParams): boolean {
  return !utm.source && !utm.medium && !utm.campaign && !utm.content && !utm.term
}

/**
 * Get default source from referer URL
 */
export function inferSourceFromReferer(referer: string | null): string | undefined {
  if (!referer) return undefined

  try {
    const url = new URL(referer)
    const hostname = url.hostname.toLowerCase()

    // Social media sources
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter'
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) return 'facebook'
    if (hostname.includes('instagram.com')) return 'instagram'
    if (hostname.includes('linkedin.com')) return 'linkedin'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    if (hostname.includes('tiktok.com')) return 'tiktok'

    // Search engines
    if (hostname.includes('google.')) return 'google'
    if (hostname.includes('yahoo.')) return 'yahoo'
    if (hostname.includes('bing.com')) return 'bing'

    // Email providers (usually indicates email campaign)
    if (hostname.includes('mail.google.com') || hostname.includes('outlook.')) return 'email'

    // Return the hostname as source for unknown sources
    return hostname.replace('www.', '')
  } catch {
    return undefined
  }
}

/**
 * Infer medium from source
 */
export function inferMediumFromSource(source: string | undefined): string | undefined {
  if (!source) return undefined

  const socialSources = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']
  const searchSources = ['google', 'yahoo', 'bing']

  if (socialSources.includes(source)) return 'social'
  if (searchSources.includes(source)) return 'organic'
  if (source === 'email') return 'email'

  return 'referral'
}
