import { z } from 'zod'

// Enums
export const FunnelStepType = {
  LANDING_PAGE: 'landing_page',
  OPT_IN: 'opt_in',
  PURCHASE: 'purchase',
  THANK_YOU: 'thank_you',
  UPSELL: 'upsell',
} as const
export type FunnelStepType = (typeof FunnelStepType)[keyof typeof FunnelStepType]

export const ConversionEventType = {
  PAGE_VIEW: 'page_view',
  CLICK: 'click',
  OPT_IN: 'opt_in',
  PURCHASE: 'purchase',
  UPSELL_ACCEPTED: 'upsell_accepted',
  UPSELL_DECLINED: 'upsell_declined',
} as const
export type ConversionEventType = (typeof ConversionEventType)[keyof typeof ConversionEventType]

export const TrackingLinkStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  EXPIRED: 'expired',
} as const
export type TrackingLinkStatus = (typeof TrackingLinkStatus)[keyof typeof TrackingLinkStatus]

// UTM Parameters
export interface UtmParams {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
}

export const utmParamsSchema = z.object({
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  content: z.string().optional(),
  term: z.string().optional(),
})

// Funnel
export interface Funnel {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FunnelStep {
  id: string
  funnel_id: string
  step_type: FunnelStepType
  step_order: number
  name: string
  page_id: string | null
  target_url: string | null
  created_at: string
}

export interface FunnelWithSteps extends Funnel {
  steps: FunnelStep[]
}

// Schemas
export const createFunnelSchema = z.object({
  name: z.string().min(1, 'ファネル名は必須です').max(255),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
})

export const updateFunnelSchema = createFunnelSchema.partial()

export const createFunnelStepSchema = z.object({
  step_type: z.enum(['landing_page', 'opt_in', 'purchase', 'thank_you', 'upsell']),
  step_order: z.number().int().min(0),
  name: z.string().min(1).max(255),
  page_id: z.string().uuid().optional(),
  target_url: z.string().url().optional(),
})

// Visitor
export interface Visitor {
  id: string
  user_id: string
  fingerprint: string | null
  cookie_id: string | null
  ip_address: string | null
  user_agent: string | null
  first_utm: UtmParams
  first_referrer: string | null
  first_seen_at: string
  last_seen_at: string
}

// Conversion Event
export interface ConversionEvent {
  id: string
  user_id: string
  visitor_id: string | null
  contact_id: string | null
  funnel_id: string | null
  step_id: string | null
  event_type: ConversionEventType
  page_url: string | null
  utm_params: UtmParams
  referrer_code: string | null
  metadata: Record<string, unknown>
  occurred_at: string
}

export const recordConversionEventSchema = z.object({
  visitor_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  funnel_id: z.string().uuid().optional(),
  step_id: z.string().uuid().optional(),
  event_type: z.enum(['page_view', 'click', 'opt_in', 'purchase', 'upsell_accepted', 'upsell_declined']),
  page_url: z.string().url().optional(),
  utm_params: utmParamsSchema.optional(),
  referrer_code: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Tracking Link
export interface TrackingLink {
  id: string
  user_id: string
  name: string
  short_code: string
  destination_url: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  funnel_id: string | null
  click_count: number
  conversion_count: number
  status: TrackingLinkStatus
  expires_at: string | null
  created_at: string
  updated_at: string
}

export const createTrackingLinkSchema = z.object({
  name: z.string().min(1, 'リンク名は必須です').max(255),
  destination_url: z.string().url('有効なURLを入力してください'),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  funnel_id: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'expired']).optional().default('active'),
  expires_at: z.string().datetime().optional(),
})

export const updateTrackingLinkSchema = createTrackingLinkSchema.partial()

// Link Click
export interface LinkClick {
  id: string
  tracking_link_id: string
  visitor_id: string | null
  ip_address: string | null
  user_agent: string | null
  referer: string | null
  clicked_at: string
}

// Funnel Daily Stats
export interface FunnelDailyStats {
  id: string
  user_id: string
  funnel_id: string
  step_id: string | null
  date: string
  visitors: number
  conversions: number
  revenue: number
}

// Analytics Response Types
export interface FunnelStepStats {
  step_id: string
  step_name: string
  step_order: number
  total_visitors: number
  total_conversions: number
  conversion_rate: number
}

export interface FunnelAnalytics {
  funnel: Funnel
  steps: FunnelStepStats[]
  total_visitors: number
  total_conversions: number
  overall_conversion_rate: number
  period: {
    start_date: string
    end_date: string
  }
}

export interface TrackingLinkStats {
  link: TrackingLink
  clicks_by_date: Array<{
    date: string
    clicks: number
    unique_clicks: number
  }>
  top_referrers: Array<{
    referer: string
    count: number
  }>
  conversion_rate: number
}

// Request Types for Public Tracking API
export interface TrackVisitorRequest {
  fingerprint?: string
  cookie_id?: string
  user_agent?: string
  utm_params?: UtmParams
  referrer?: string
}

export interface TrackEventRequest {
  visitor_id?: string
  cookie_id?: string
  fingerprint?: string
  event_type: ConversionEventType
  page_url?: string
  funnel_id?: string
  step_id?: string
  referrer_code?: string
  metadata?: Record<string, unknown>
}

// API Response Types
export interface TrackingApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedTrackingResponse<T> {
  success: boolean
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    total_pages: number
  }
}
