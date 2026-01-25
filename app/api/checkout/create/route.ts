import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { createCheckoutSessionSchema } from '@/lib/types/payment'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const body = await request.json()
    const validation = createCheckoutSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Get product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', validation.data.product_id)
      .eq('status', 'active')
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: '商品が見つかりません' },
        { status: 404 }
      )
    }

    // Get or create customer if email provided
    let customer = null
    if (validation.data.customer_email) {
      // Find existing contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', product.user_id)
        .eq('email', validation.data.customer_email)
        .single()

      if (contact) {
        // Find existing customer
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', product.user_id)
          .eq('contact_id', contact.id)
          .single()

        customer = existingCustomer
      }
    }

    // Create Stripe checkout session
    const result = await createCheckoutSession({
      product,
      customer,
      successUrl: validation.data.success_url,
      cancelUrl: validation.data.cancel_url,
      referrerCode: validation.data.referrer_code,
      funnelId: validation.data.funnel_id,
      landingPageId: validation.data.landing_page_id,
      metadata: validation.data.metadata,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        session_id: result.sessionId,
        checkout_url: result.checkoutUrl,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'チェックアウトセッションの作成に失敗しました' },
      { status: 500 }
    )
  }
}
