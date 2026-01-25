import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, handleStripeEvent } from '@/lib/stripe/webhook-handler'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'Missing Stripe signature' },
        { status: 400 }
      )
    }

    const event = await verifyWebhookSignature(payload, signature)

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const result = await handleStripeEvent(event)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Webhook handling failed' },
      { status: 500 }
    )
  }
}
