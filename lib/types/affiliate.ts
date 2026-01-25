import { z } from 'zod'

// Affiliate Status
export const AffiliateStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
} as const
export type AffiliateStatus = (typeof AffiliateStatus)[keyof typeof AffiliateStatus]

export const CommissionStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const
export type CommissionStatus = (typeof CommissionStatus)[keyof typeof CommissionStatus]

export const PayoutStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus]

// Affiliate
export interface Affiliate {
  id: string
  user_id: string
  contact_id: string | null
  email: string
  name: string
  referral_code: string
  commission_rate: number
  custom_rates: Record<string, number> // product_id -> rate
  status: AffiliateStatus
  payment_info: {
    bank_name?: string
    account_number?: string
    account_name?: string
    paypal_email?: string
  }
  total_earned: number
  total_paid: number
  pending_amount: number
  referral_count: number
  conversion_count: number
  approved_at: string | null
  created_at: string
  updated_at: string
}

// Affiliate Link
export interface AffiliateLink {
  id: string
  affiliate_id: string
  landing_page_id: string | null
  product_id: string | null
  custom_slug: string | null
  click_count: number
  conversion_count: number
  created_at: string
}

// Referral Click
export interface ReferralClick {
  id: string
  user_id: string
  affiliate_id: string
  visitor_id: string | null
  referral_code: string
  landing_page_id: string | null
  ip_address: string | null
  user_agent: string | null
  referer: string | null
  clicked_at: string
}

// Commission
export interface Commission {
  id: string
  user_id: string
  affiliate_id: string
  purchase_id: string
  product_id: string
  sale_amount: number
  commission_rate: number
  commission_amount: number
  status: CommissionStatus
  approved_at: string | null
  paid_at: string | null
  payout_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Payout
export interface AffiliatePayout {
  id: string
  user_id: string
  affiliate_id: string
  amount: number
  commission_ids: string[]
  status: PayoutStatus
  payment_method: string | null
  payment_reference: string | null
  processed_at: string | null
  notes: string | null
  created_at: string
}

// Zod Schemas
export const createAffiliateSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  name: z.string().min(1, '名前は必須です').max(255),
  commission_rate: z.number().min(0).max(100).default(20),
  custom_rates: z.record(z.number().min(0).max(100)).optional(),
  payment_info: z.object({
    bank_name: z.string().optional(),
    account_number: z.string().optional(),
    account_name: z.string().optional(),
    paypal_email: z.string().email().optional(),
  }).optional(),
})

export const updateAffiliateSchema = createAffiliateSchema.partial()

export const approveAffiliateSchema = z.object({
  affiliate_id: z.string().uuid(),
})

export const bulkApproveCommissionsSchema = z.object({
  commission_ids: z.array(z.string().uuid()).min(1),
})

export const createPayoutSchema = z.object({
  affiliate_id: z.string().uuid(),
  commission_ids: z.array(z.string().uuid()).min(1),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
})

export const processPayoutSchema = z.object({
  payout_id: z.string().uuid(),
  payment_reference: z.string().optional(),
})

// API Response Types
export interface AffiliateWithStats extends Affiliate {
  recent_commissions?: Commission[]
  monthly_earnings?: number
}

export interface CommissionWithDetails extends Commission {
  affiliate?: Affiliate
  purchase?: {
    id: string
    amount: number
    product_name: string
  }
}

export interface AffiliateAnalytics {
  total_affiliates: number
  active_affiliates: number
  total_commissions_paid: number
  pending_commissions: number
  top_affiliates: Array<{
    affiliate: Affiliate
    total_revenue: number
    conversion_count: number
  }>
  commissions_by_month: Array<{
    month: string
    amount: number
  }>
}

// Public Affiliate Dashboard Types
export interface AffiliateDashboardData {
  affiliate: Affiliate
  referral_url: string
  stats: {
    total_clicks: number
    total_conversions: number
    conversion_rate: number
    total_earned: number
    pending_amount: number
    total_paid: number
  }
  recent_commissions: Commission[]
  clicks_by_date: Array<{
    date: string
    clicks: number
  }>
}
