import { createClient } from '@/lib/supabase/server'
import type {
  ConversionEvent,
  ConversionEventType,
  TrackEventRequest,
  UtmParams,
  Visitor,
} from '@/lib/types/tracking'
import {
  extractVisitorInfo,
  generateCookieId,
  generateFingerprint,
} from './fingerprint'
import { parseUtmParams, inferSourceFromReferer, inferMediumFromSource } from './utm-parser'

interface RecordEventResult {
  success: boolean
  visitor_id?: string
  event_id?: string
  error?: string
}

/**
 * Get or create a visitor record
 */
export async function getOrCreateVisitor(
  userId: string,
  data: {
    cookie_id?: string
    fingerprint?: string
    ip_address?: string
    user_agent?: string
    utm_params?: UtmParams
    referrer?: string
  }
): Promise<{ visitor: Visitor | null; is_new: boolean; error?: string }> {
  const supabase = await createClient()

  // Try to find existing visitor by cookie_id or fingerprint
  if (data.cookie_id || data.fingerprint) {
    const { data: existing } = await supabase
      .from('visitors')
      .select('*')
      .eq('user_id', userId)
      .or(
        [
          data.cookie_id ? `cookie_id.eq.${data.cookie_id}` : null,
          data.fingerprint ? `fingerprint.eq.${data.fingerprint}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .limit(1)
      .single()

    if (existing) {
      // Update last_seen_at
      await supabase
        .from('visitors')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', existing.id)

      return { visitor: existing as Visitor, is_new: false }
    }
  }

  // Create new visitor
  const newVisitor = {
    user_id: userId,
    fingerprint: data.fingerprint || null,
    cookie_id: data.cookie_id || generateCookieId(),
    ip_address: data.ip_address || null,
    user_agent: data.user_agent || null,
    first_utm: data.utm_params || {},
    first_referrer: data.referrer || null,
  }

  const { data: created, error } = await supabase
    .from('visitors')
    .insert(newVisitor)
    .select()
    .single()

  if (error) {
    return { visitor: null, is_new: false, error: error.message }
  }

  return { visitor: created as Visitor, is_new: true }
}

/**
 * Record a conversion event
 */
export async function recordConversionEvent(
  userId: string,
  event: TrackEventRequest,
  headers?: Headers
): Promise<RecordEventResult> {
  const supabase = await createClient()

  // Extract visitor info from headers if available
  const visitorInfo = headers ? extractVisitorInfo(headers) : {}

  // Parse UTM from page_url if provided
  const urlUtm = event.page_url ? parseUtmParams(event.page_url) : {}

  // Infer source from referrer if not in UTM
  const inferredSource = inferSourceFromReferer(visitorInfo.referer)
  const inferredMedium = inferMediumFromSource(inferredSource)

  const utmParams: UtmParams = {
    source: urlUtm.source || inferredSource,
    medium: urlUtm.medium || inferredMedium,
    campaign: urlUtm.campaign,
    content: urlUtm.content,
    term: urlUtm.term,
  }

  // Get or create visitor
  let visitorId = event.visitor_id

  if (!visitorId) {
    const fingerprint = visitorInfo.ip_address && visitorInfo.user_agent
      ? generateFingerprint({
          ip_address: visitorInfo.ip_address,
          user_agent: visitorInfo.user_agent,
          accept_language: visitorInfo.accept_language || undefined,
        })
      : undefined

    const { visitor, error: visitorError } = await getOrCreateVisitor(userId, {
      cookie_id: event.cookie_id,
      fingerprint: event.fingerprint || fingerprint,
      ip_address: visitorInfo.ip_address || undefined,
      user_agent: visitorInfo.user_agent || undefined,
      utm_params: utmParams,
      referrer: visitorInfo.referer || undefined,
    })

    if (visitorError || !visitor) {
      return { success: false, error: visitorError || 'Failed to get visitor' }
    }

    visitorId = visitor.id
  }

  // Create conversion event
  const conversionEvent = {
    user_id: userId,
    visitor_id: visitorId,
    contact_id: null, // Will be linked later when contact is identified
    funnel_id: event.funnel_id || null,
    step_id: event.step_id || null,
    event_type: event.event_type,
    page_url: event.page_url || null,
    utm_params: utmParams,
    referrer_code: event.referrer_code || null,
    metadata: event.metadata || {},
  }

  const { data: created, error } = await supabase
    .from('conversion_events')
    .insert(conversionEvent)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Update funnel daily stats if funnel_id is provided
  if (event.funnel_id) {
    await updateFunnelDailyStats(userId, event.funnel_id, event.step_id || null, event.event_type)
  }

  return {
    success: true,
    visitor_id: visitorId,
    event_id: created.id,
  }
}

/**
 * Update funnel daily stats
 */
async function updateFunnelDailyStats(
  userId: string,
  funnelId: string,
  stepId: string | null,
  eventType: ConversionEventType
): Promise<void> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const isConversion = eventType === 'opt_in' || eventType === 'purchase' || eventType === 'upsell_accepted'

  // Upsert stats
  const { error } = await supabase.rpc('upsert_funnel_daily_stats', {
    p_user_id: userId,
    p_funnel_id: funnelId,
    p_step_id: stepId,
    p_date: today,
    p_is_visitor: eventType === 'page_view',
    p_is_conversion: isConversion,
  })

  // If RPC doesn't exist, fall back to manual upsert
  if (error?.code === '42883') {
    const { data: existing } = await supabase
      .from('funnel_daily_stats')
      .select('*')
      .eq('funnel_id', funnelId)
      .eq('date', today)
      .is('step_id', stepId)
      .single()

    if (existing) {
      await supabase
        .from('funnel_daily_stats')
        .update({
          visitors: eventType === 'page_view' ? existing.visitors + 1 : existing.visitors,
          conversions: isConversion ? existing.conversions + 1 : existing.conversions,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('funnel_daily_stats').insert({
        user_id: userId,
        funnel_id: funnelId,
        step_id: stepId,
        date: today,
        visitors: eventType === 'page_view' ? 1 : 0,
        conversions: isConversion ? 1 : 0,
        revenue: 0,
      })
    }
  }
}

/**
 * Link visitor to contact when identified
 */
export async function linkVisitorToContact(
  visitorId: string,
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Update all events for this visitor to include the contact_id
  const { error } = await supabase
    .from('conversion_events')
    .update({ contact_id: contactId })
    .eq('visitor_id', visitorId)
    .is('contact_id', null)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Record a tracking link click
 */
export async function recordLinkClick(
  trackingLinkId: string,
  data: {
    visitor_id?: string
    ip_address?: string
    user_agent?: string
    referer?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Insert click record
  const { error: clickError } = await supabase.from('link_clicks').insert({
    tracking_link_id: trackingLinkId,
    visitor_id: data.visitor_id || null,
    ip_address: data.ip_address || null,
    user_agent: data.user_agent || null,
    referer: data.referer || null,
  })

  if (clickError) {
    return { success: false, error: clickError.message }
  }

  // Increment click count on tracking link
  const { error: updateError } = await supabase.rpc('increment_tracking_link_clicks', {
    link_id: trackingLinkId,
  })

  // Fall back to manual update if RPC fails
  if (updateError) {
    await supabase
      .from('tracking_links')
      .update({
        click_count: supabase.rpc('increment', { x: 1 }) as unknown as number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackingLinkId)
  }

  return { success: true }
}

/**
 * Get conversion events for a visitor
 */
export async function getVisitorEvents(
  userId: string,
  visitorId: string
): Promise<ConversionEvent[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('conversion_events')
    .select('*')
    .eq('user_id', userId)
    .eq('visitor_id', visitorId)
    .order('occurred_at', { ascending: true })

  if (error) {
    return []
  }

  return data as ConversionEvent[]
}
