import { getStripeClient } from './client'
import { createClient } from '@/lib/supabase/server'
import type { Product, Customer } from '@/lib/types/payment'

interface CreateCheckoutOptions {
  product: Product
  customer?: Customer
  successUrl: string
  cancelUrl: string
  referrerCode?: string
  funnelId?: string
  landingPageId?: string
  metadata?: Record<string, string>
}

interface CheckoutResult {
  success: boolean
  sessionId?: string
  checkoutUrl?: string
  error?: string
}

export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<CheckoutResult> {
  const stripe = getStripeClient()
  const supabase = await createClient()

  try {
    // Get or create Stripe customer
    let stripeCustomerId: string | undefined

    if (options.customer?.stripe_customer_id) {
      stripeCustomerId = options.customer.stripe_customer_id
    } else if (options.customer) {
      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: options.customer.email,
        name: options.customer.name || undefined,
        metadata: {
          customer_id: options.customer.id,
          user_id: options.customer.user_id,
        },
      })

      stripeCustomerId = stripeCustomer.id

      // Update customer with Stripe ID
      await supabase
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', options.customer.id)
    }

    // Get or create Stripe price
    let stripePriceId = options.product.stripe_price_id

    if (!stripePriceId) {
      // Create product and price in Stripe
      const stripeProduct = await stripe.products.create({
        name: options.product.name,
        description: options.product.description || undefined,
        images: options.product.image_url ? [options.product.image_url] : undefined,
        metadata: {
          product_id: options.product.id,
          user_id: options.product.user_id,
        },
      })

      const priceParams: Parameters<typeof stripe.prices.create>[0] = {
        product: stripeProduct.id,
        currency: options.product.currency.toLowerCase(),
        metadata: {
          product_id: options.product.id,
        },
      }

      if (options.product.product_type === 'subscription') {
        priceParams.recurring = {
          interval: (options.product.recurring_interval as 'month' | 'year') || 'month',
          interval_count: options.product.recurring_interval_count || 1,
        }
        priceParams.unit_amount = Math.round(options.product.price)
      } else {
        priceParams.unit_amount = Math.round(options.product.price)
      }

      const stripePrice = await stripe.prices.create(priceParams)
      stripePriceId = stripePrice.id

      // Update product with Stripe IDs
      await supabase
        .from('products')
        .update({
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
        })
        .eq('id', options.product.id)
    }

    // Create checkout session
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: options.product.product_type === 'subscription' ? 'subscription' : 'payment',
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      metadata: {
        product_id: options.product.id,
        user_id: options.product.user_id,
        referrer_code: options.referrerCode || '',
        funnel_id: options.funnelId || '',
        landing_page_id: options.landingPageId || '',
        ...options.metadata,
      },
      payment_intent_data: options.product.product_type === 'one_time' ? {
        metadata: {
          product_id: options.product.id,
          user_id: options.product.user_id,
        },
      } : undefined,
    }

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId
    } else {
      sessionParams.customer_creation = 'always'
    }

    // Add affiliate metadata if referrer code exists
    if (options.referrerCode) {
      // Find affiliate by referral code
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('id')
        .eq('referral_code', options.referrerCode)
        .eq('status', 'approved')
        .single()

      if (affiliate) {
        sessionParams.metadata = {
          ...sessionParams.metadata,
          affiliate_id: affiliate.id,
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return {
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Checkout session creation failed',
    }
  }
}

export async function getCheckoutSession(sessionId: string) {
  const stripe = getStripeClient()

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'payment_intent'],
    })
    return session
  } catch {
    return null
  }
}

export async function cancelSubscription(subscriptionId: string) {
  const stripe = getStripeClient()

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
    return { success: true, subscription }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription',
    }
  }
}

export async function resumeSubscription(subscriptionId: string) {
  const stripe = getStripeClient()

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })
    return { success: true, subscription }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume subscription',
    }
  }
}
