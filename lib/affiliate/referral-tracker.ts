import { createClient } from '@/lib/supabase/server'
import type { Affiliate, Commission } from '@/lib/types/affiliate'

// Characters for referral code (excluding similar-looking chars)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateReferralCode(length: number = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function generateUniqueReferralCode(): Promise<string> {
  const supabase = await createClient()
  let code = generateReferralCode()
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('affiliates')
      .select('id')
      .eq('referral_code', code)
      .single()

    if (!existing) {
      return code
    }

    code = generateReferralCode()
    attempts++
  }

  // If we can't find unique code, add timestamp suffix
  return `${code}${Date.now().toString(36).slice(-2).toUpperCase()}`
}

export async function getAffiliateByCode(referralCode: string): Promise<Affiliate | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('referral_code', referralCode.toUpperCase())
    .eq('status', 'approved')
    .single()

  if (error || !data) {
    return null
  }

  return data as Affiliate
}

export async function recordReferralClick(
  userId: string,
  affiliateId: string,
  referralCode: string,
  options: {
    visitorId?: string
    landingPageId?: string
    ipAddress?: string
    userAgent?: string
    referer?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('referral_clicks').insert({
    user_id: userId,
    affiliate_id: affiliateId,
    referral_code: referralCode,
    visitor_id: options.visitorId || null,
    landing_page_id: options.landingPageId || null,
    ip_address: options.ipAddress || null,
    user_agent: options.userAgent || null,
    referer: options.referer || null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Update affiliate referral count
  await supabase.rpc('increment_affiliate_referral_count', {
    p_affiliate_id: affiliateId,
  }).catch(() => {
    // Fall back to manual update
    supabase
      .from('affiliates')
      .update({
        referral_count: supabase.rpc('increment', { x: 1 }) as unknown as number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliateId)
  })

  return { success: true }
}

export async function calculateCommission(
  affiliateId: string,
  productId: string,
  saleAmount: number
): Promise<{ rate: number; amount: number }> {
  const supabase = await createClient()

  // Get affiliate with custom rates
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('commission_rate, custom_rates')
    .eq('id', affiliateId)
    .single()

  if (!affiliate) {
    return { rate: 0, amount: 0 }
  }

  // Check for product-specific rate
  const customRates = affiliate.custom_rates as Record<string, number> || {}
  const rate = customRates[productId] ?? affiliate.commission_rate

  const amount = (saleAmount * rate) / 100

  return { rate, amount }
}

export async function approveCommission(
  commissionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('commissions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', commissionId)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function bulkApproveCommissions(
  commissionIds: string[],
  userId: string
): Promise<{ success: boolean; approved: number; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commissions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', commissionIds)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    return { success: false, approved: 0, error: error.message }
  }

  return { success: true, approved: data?.length || 0 }
}

export async function createPayout(
  userId: string,
  affiliateId: string,
  commissionIds: string[],
  options: {
    paymentMethod?: string
    notes?: string
  } = {}
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  const supabase = await createClient()

  // Get approved commissions
  const { data: commissions, error: fetchError } = await supabase
    .from('commissions')
    .select('id, commission_amount')
    .in('id', commissionIds)
    .eq('affiliate_id', affiliateId)
    .eq('status', 'approved')

  if (fetchError || !commissions?.length) {
    return {
      success: false,
      error: fetchError?.message || '承認済みのコミッションがありません',
    }
  }

  // Calculate total amount
  const totalAmount = commissions.reduce((sum, c) => sum + c.commission_amount, 0)

  // Create payout
  const { data: payout, error: payoutError } = await supabase
    .from('affiliate_payouts')
    .insert({
      user_id: userId,
      affiliate_id: affiliateId,
      amount: totalAmount,
      commission_ids: commissions.map((c) => c.id),
      payment_method: options.paymentMethod || null,
      notes: options.notes || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (payoutError || !payout) {
    return { success: false, error: payoutError?.message || 'Failed to create payout' }
  }

  // Update commissions with payout_id
  await supabase
    .from('commissions')
    .update({
      payout_id: payout.id,
      updated_at: new Date().toISOString(),
    })
    .in('id', commissions.map((c) => c.id))

  return { success: true, payoutId: payout.id }
}

export async function processPayout(
  payoutId: string,
  userId: string,
  paymentReference?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get payout with commission IDs
  const { data: payout, error: fetchError } = await supabase
    .from('affiliate_payouts')
    .select('id, commission_ids, status')
    .eq('id', payoutId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !payout) {
    return { success: false, error: '支払いが見つかりません' }
  }

  if (payout.status !== 'pending') {
    return { success: false, error: 'この支払いは既に処理済みです' }
  }

  // Update payout status
  const { error: updateError } = await supabase
    .from('affiliate_payouts')
    .update({
      status: 'completed',
      payment_reference: paymentReference || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', payoutId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Update commissions to paid
  const commissionIds = payout.commission_ids as string[]
  await supabase
    .from('commissions')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', commissionIds)

  return { success: true }
}

export async function getAffiliateStats(affiliateId: string): Promise<{
  totalClicks: number
  totalConversions: number
  conversionRate: number
  totalEarned: number
  pendingAmount: number
  totalPaid: number
}> {
  const supabase = await createClient()

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('referral_count, conversion_count, total_earned, pending_amount, total_paid')
    .eq('id', affiliateId)
    .single()

  if (!affiliate) {
    return {
      totalClicks: 0,
      totalConversions: 0,
      conversionRate: 0,
      totalEarned: 0,
      pendingAmount: 0,
      totalPaid: 0,
    }
  }

  const conversionRate = affiliate.referral_count > 0
    ? (affiliate.conversion_count / affiliate.referral_count) * 100
    : 0

  return {
    totalClicks: affiliate.referral_count,
    totalConversions: affiliate.conversion_count,
    conversionRate: Math.round(conversionRate * 100) / 100,
    totalEarned: affiliate.total_earned,
    pendingAmount: affiliate.pending_amount,
    totalPaid: affiliate.total_paid,
  }
}
