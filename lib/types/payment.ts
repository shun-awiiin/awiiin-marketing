import { z } from 'zod'

// Product Types
export const ProductType = {
  ONE_TIME: 'one_time',
  SUBSCRIPTION: 'subscription',
} as const
export type ProductType = (typeof ProductType)[keyof typeof ProductType]

export const ProductStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus]

export const PurchaseStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const
export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus]

export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  TRIALING: 'trialing',
  PAUSED: 'paused',
} as const
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

// Product
export interface Product {
  id: string
  user_id: string
  stripe_product_id: string | null
  stripe_price_id: string | null
  name: string
  description: string | null
  price: number
  currency: string
  product_type: ProductType
  recurring_interval: string | null
  recurring_interval_count: number | null
  image_url: string | null
  status: ProductStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Customer
export interface Customer {
  id: string
  user_id: string
  contact_id: string
  stripe_customer_id: string | null
  email: string
  name: string | null
  phone: string | null
  address: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  } | null
  lifetime_value: number
  purchase_count: number
  first_purchase_at: string | null
  last_purchase_at: string | null
  created_at: string
  updated_at: string
}

// Purchase
export interface Purchase {
  id: string
  user_id: string
  customer_id: string
  product_id: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  amount: number
  currency: string
  status: PurchaseStatus
  referrer_code: string | null
  affiliate_id: string | null
  funnel_id: string | null
  landing_page_id: string | null
  metadata: Record<string, unknown>
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Subscription
export interface Subscription {
  id: string
  user_id: string
  customer_id: string
  product_id: string
  purchase_id: string | null
  stripe_subscription_id: string
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  trial_start: string | null
  trial_end: string | null
  created_at: string
  updated_at: string
}

// Thank You Page
export interface ThankYouPage {
  id: string
  user_id: string
  product_id: string | null
  title: string
  slug: string
  content: {
    message?: string
    next_steps?: string[]
    video_url?: string
  }
  upsell_product_id: string | null
  redirect_url: string | null
  redirect_delay_seconds: number
  created_at: string
  updated_at: string
}

// Zod Schemas
export const createProductSchema = z.object({
  name: z.string().min(1, '商品名は必須です').max(255),
  description: z.string().optional(),
  price: z.number().positive('価格は0より大きい必要があります'),
  currency: z.string().length(3).default('JPY'),
  product_type: z.enum(['one_time', 'subscription']).default('one_time'),
  recurring_interval: z.enum(['month', 'year']).optional(),
  recurring_interval_count: z.number().int().positive().optional(),
  image_url: z.string().url().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional().default('active'),
  metadata: z.record(z.unknown()).optional(),
})

export const updateProductSchema = createProductSchema.partial()

export const createCheckoutSessionSchema = z.object({
  product_id: z.string().uuid(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  customer_email: z.string().email().optional(),
  referrer_code: z.string().max(50).optional(),
  funnel_id: z.string().uuid().optional(),
  landing_page_id: z.string().uuid().optional(),
  metadata: z.record(z.string()).optional(),
})

export const createThankYouPageSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  product_id: z.string().uuid().optional(),
  content: z.object({
    message: z.string().optional(),
    next_steps: z.array(z.string()).optional(),
    video_url: z.string().url().optional(),
  }).optional(),
  upsell_product_id: z.string().uuid().optional(),
  redirect_url: z.string().url().optional(),
  redirect_delay_seconds: z.number().int().min(0).optional(),
})

export const updateThankYouPageSchema = createThankYouPageSchema.partial()

// Stripe Webhook Event Types
export type StripeWebhookEvent =
  | 'checkout.session.completed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'

// API Types
export interface CheckoutSessionResponse {
  session_id: string
  checkout_url: string
}

export interface ProductWithStats extends Product {
  total_sales?: number
  total_revenue?: number
  active_subscriptions?: number
}

export interface PurchaseWithDetails extends Purchase {
  customer?: Customer
  product?: Product
}

export interface CustomerWithPurchases extends Customer {
  purchases?: Purchase[]
  subscriptions?: Subscription[]
}
