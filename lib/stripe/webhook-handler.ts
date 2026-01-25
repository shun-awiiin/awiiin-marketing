import Stripe from 'stripe'
import { getStripeClient } from './client'
import { createClient } from '@/lib/supabase/server'

export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event | null> {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch {
    return null
  }
}

export async function handleStripeEvent(event: Stripe.Event): Promise<{
  success: boolean
  error?: string
}> {
  const supabase = await createClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(supabase, paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(supabase, paymentIntent)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(supabase, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(supabase, invoice)
        break
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook handling failed',
    }
  }
}

async function handleCheckoutCompleted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Stripe.Checkout.Session
) {
  const metadata = session.metadata || {}
  const productId = metadata.product_id
  const userId = metadata.user_id
  const affiliateId = metadata.affiliate_id
  const referrerCode = metadata.referrer_code
  const funnelId = metadata.funnel_id
  const landingPageId = metadata.landing_page_id

  if (!productId || !userId) {
    return
  }

  // Get or create customer
  const customerEmail = session.customer_email || (session.customer_details?.email)
  const customerName = session.customer_details?.name

  if (!customerEmail) {
    return
  }

  // Find or create contact
  let contactId: string

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('email', customerEmail)
    .single()

  if (existingContact) {
    contactId = existingContact.id
  } else {
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        email: customerEmail,
        first_name: customerName?.split(' ')[0] || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (contactError || !newContact) {
      return
    }
    contactId = newContact.id
  }

  // Find or create customer
  let customerId: string

  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .single()

  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        contact_id: contactId,
        email: customerEmail,
        name: customerName || null,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
      })
      .select('id')
      .single()

    if (customerError || !newCustomer) {
      return
    }
    customerId = newCustomer.id
  }

  // Create purchase record
  const amount = session.amount_total ? session.amount_total / 100 : 0

  const { error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      customer_id: customerId,
      product_id: productId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
      amount,
      currency: session.currency?.toUpperCase() || 'JPY',
      status: 'completed',
      referrer_code: referrerCode || null,
      affiliate_id: affiliateId || null,
      funnel_id: funnelId || null,
      landing_page_id: landingPageId || null,
      completed_at: new Date().toISOString(),
    })

  if (purchaseError) {
    throw purchaseError
  }
}

async function handlePaymentSucceeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paymentIntent: Stripe.PaymentIntent
) {
  // Update purchase status if exists
  await supabase
    .from('purchases')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handlePaymentFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paymentIntent: Stripe.PaymentIntent
) {
  // Update purchase status if exists
  await supabase
    .from('purchases')
    .update({
      status: 'failed',
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handleSubscriptionUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Stripe.Subscription
) {
  // Find purchase with this subscription
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, user_id, customer_id, product_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!purchase) {
    return
  }

  // Upsert subscription record
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: purchase.user_id,
      customer_id: purchase.customer_id,
      product_id: purchase.product_id,
      purchase_id: purchase.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status as 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'paused',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    }, {
      onConflict: 'stripe_subscription_id',
    })
}

async function handleSubscriptionDeleted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Stripe.Subscription
) {
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handleInvoicePaid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: Stripe.Invoice
) {
  // Update subscription status if applicable
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({ status: 'active' })
      .eq('stripe_subscription_id', invoice.subscription)
  }
}

async function handleInvoicePaymentFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: Stripe.Invoice
) {
  // Update subscription status
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', invoice.subscription)
  }
}
