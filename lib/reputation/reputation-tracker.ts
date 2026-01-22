/**
 * Reputation Tracker Service
 * Tracks sender reputation metrics, domain warmup progress,
 * and ISP-specific delivery data
 */

import { createServiceClient } from '@/lib/supabase/server';
import type {
  ReputationMetrics,
  ReputationSummary,
  DomainWarmup,
  WarmupProgress,
  WarmupDay,
} from '@/lib/types/deliverability';
import { WARMUP_SCHEDULE_DEFAULT } from '@/lib/types/deliverability';

// ============================================
// REPUTATION METRICS
// ============================================

/**
 * Get reputation metrics for a date range
 */
export async function getReputationMetrics(
  userId: string,
  domain?: string,
  days: number = 30
): Promise<ReputationMetrics[]> {
  const supabase = await createServiceClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('reputation_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (domain) {
    query = query.eq('domain', domain);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get reputation metrics: ${error.message}`);
  }

  return data as ReputationMetrics[];
}

/**
 * Get reputation summary for a domain
 */
export async function getReputationSummary(
  userId: string,
  domain: string,
  period: '7d' | '30d' | '90d' = '30d'
): Promise<ReputationSummary> {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const metrics = await getReputationMetrics(userId, domain, days);

  if (metrics.length === 0) {
    return {
      domain,
      period,
      total_sent: 0,
      avg_delivery_rate: 0,
      avg_bounce_rate: 0,
      avg_complaint_rate: 0,
      avg_open_rate: 0,
      avg_click_rate: 0,
      trend: {
        delivery_rate: 'stable',
        bounce_rate: 'stable',
        complaint_rate: 'stable',
      },
      risk_level: 'healthy',
      daily_metrics: [],
    };
  }

  // Calculate averages
  const totalSent = metrics.reduce((sum, m) => sum + m.total_sent, 0);
  const avgDeliveryRate = metrics.reduce((sum, m) => sum + m.delivery_rate, 0) / metrics.length;
  const avgBounceRate = metrics.reduce((sum, m) => sum + m.bounce_rate, 0) / metrics.length;
  const avgComplaintRate = metrics.reduce((sum, m) => sum + m.complaint_rate, 0) / metrics.length;
  const avgOpenRate = metrics.reduce((sum, m) => sum + m.open_rate, 0) / metrics.length;
  const avgClickRate = metrics.reduce((sum, m) => sum + m.click_rate, 0) / metrics.length;

  // Calculate trends (compare first half to second half)
  const midpoint = Math.floor(metrics.length / 2);
  const firstHalf = metrics.slice(0, midpoint);
  const secondHalf = metrics.slice(midpoint);

  const trend = {
    delivery_rate: calculateTrend(
      firstHalf.map((m) => m.delivery_rate),
      secondHalf.map((m) => m.delivery_rate)
    ),
    bounce_rate: calculateTrend(
      firstHalf.map((m) => m.bounce_rate),
      secondHalf.map((m) => m.bounce_rate)
    ),
    complaint_rate: calculateTrend(
      firstHalf.map((m) => m.complaint_rate),
      secondHalf.map((m) => m.complaint_rate)
    ),
  };

  // Determine risk level
  let riskLevel: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (avgBounceRate >= 5 || avgComplaintRate >= 0.1) {
    riskLevel = 'critical';
  } else if (avgBounceRate >= 2 || avgComplaintRate >= 0.05) {
    riskLevel = 'warning';
  }

  return {
    domain,
    period,
    total_sent: totalSent,
    avg_delivery_rate: Math.round(avgDeliveryRate * 100) / 100,
    avg_bounce_rate: Math.round(avgBounceRate * 100) / 100,
    avg_complaint_rate: Math.round(avgComplaintRate * 1000) / 1000,
    avg_open_rate: Math.round(avgOpenRate * 100) / 100,
    avg_click_rate: Math.round(avgClickRate * 100) / 100,
    trend,
    risk_level: riskLevel,
    daily_metrics: metrics,
  };
}

/**
 * Calculate trend direction
 */
function calculateTrend(
  firstHalf: number[],
  secondHalf: number[]
): 'up' | 'down' | 'stable' {
  if (firstHalf.length === 0 || secondHalf.length === 0) {
    return 'stable';
  }

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = secondAvg - firstAvg;
  const threshold = firstAvg * 0.1; // 10% change threshold

  if (change > threshold) {
    return 'up';
  } else if (change < -threshold) {
    return 'down';
  }
  return 'stable';
}

/**
 * Record daily metrics
 */
export async function recordDailyMetrics(
  userId: string,
  domain: string,
  metrics: Partial<ReputationMetrics>
): Promise<void> {
  const supabase = await createServiceClient();

  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase.from('reputation_metrics').upsert(
    {
      user_id: userId,
      domain,
      date: today,
      total_sent: metrics.total_sent || 0,
      total_delivered: metrics.total_delivered || 0,
      total_bounced: metrics.total_bounced || 0,
      total_complained: metrics.total_complained || 0,
      total_opened: metrics.total_opened || 0,
      total_clicked: metrics.total_clicked || 0,
      delivery_rate: metrics.delivery_rate || 0,
      bounce_rate: metrics.bounce_rate || 0,
      complaint_rate: metrics.complaint_rate || 0,
      open_rate: metrics.open_rate || 0,
      click_rate: metrics.click_rate || 0,
    },
    { onConflict: 'user_id,domain,date' }
  );

  if (error) {
    throw new Error(`Failed to record metrics: ${error.message}`);
  }
}

/**
 * Update metrics from messages table
 */
export async function updateMetricsFromMessages(
  userId: string,
  domain: string,
  date?: string
): Promise<void> {
  const supabase = await createServiceClient();

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Get message stats for the date
  const { data: messages, error } = await supabase
    .from('messages')
    .select('status, opened_at, clicked_at')
    .eq('campaign_id', supabase.rpc ? undefined : undefined) // We need to join with campaigns
    .gte('sent_at', `${targetDate}T00:00:00`)
    .lt('sent_at', `${targetDate}T23:59:59`);

  // This is simplified - in production, would use proper RPC or view
  if (error) {
    console.error('Failed to get message stats:', error);
    return;
  }

  // Calculate metrics
  const stats = {
    total_sent: messages?.length || 0,
    total_delivered: messages?.filter((m) => m.status === 'delivered').length || 0,
    total_bounced: messages?.filter((m) => m.status === 'bounced').length || 0,
    total_complained: messages?.filter((m) => m.status === 'complained').length || 0,
    total_opened: messages?.filter((m) => m.opened_at).length || 0,
    total_clicked: messages?.filter((m) => m.clicked_at).length || 0,
  };

  if (stats.total_sent > 0) {
    await recordDailyMetrics(userId, domain, {
      ...stats,
      delivery_rate: (stats.total_delivered / stats.total_sent) * 100,
      bounce_rate: (stats.total_bounced / stats.total_sent) * 100,
      complaint_rate: (stats.total_complained / stats.total_sent) * 100,
      open_rate: stats.total_delivered > 0 ? (stats.total_opened / stats.total_delivered) * 100 : 0,
      click_rate: stats.total_opened > 0 ? (stats.total_clicked / stats.total_opened) * 100 : 0,
    });
  }
}

// ============================================
// DOMAIN WARMUP
// ============================================

/**
 * Start domain warmup
 */
export async function startDomainWarmup(
  userId: string,
  domain: string,
  targetLimit: number = 10000
): Promise<DomainWarmup> {
  const supabase = await createServiceClient();

  // Generate warmup schedule
  const schedule = generateWarmupSchedule(targetLimit);

  const { data, error } = await supabase
    .from('domain_warmup')
    .insert({
      user_id: userId,
      domain,
      current_day: 1,
      current_daily_limit: schedule[0].limit,
      target_daily_limit: targetLimit,
      warmup_schedule: schedule,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to start warmup: ${error.message}`);
  }

  return data as DomainWarmup;
}

/**
 * Generate warmup schedule based on target limit
 */
function generateWarmupSchedule(targetLimit: number): WarmupDay[] {
  // Use default schedule if target is 10000
  if (targetLimit === 10000) {
    return WARMUP_SCHEDULE_DEFAULT;
  }

  // Generate custom schedule
  const schedule: WarmupDay[] = [];
  let currentLimit = 50;
  let day = 1;

  while (currentLimit < targetLimit && day <= 30) {
    schedule.push({ day, limit: Math.round(currentLimit) });
    currentLimit *= 1.4; // Increase by 40% each day
    day++;
  }

  // Add final day at target limit
  schedule.push({ day, limit: targetLimit });

  return schedule;
}

/**
 * Get domain warmup status
 */
export async function getDomainWarmup(
  userId: string,
  domain: string
): Promise<DomainWarmup | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('domain_warmup')
    .select('*')
    .eq('user_id', userId)
    .eq('domain', domain)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get warmup status: ${error.message}`);
  }

  return data as DomainWarmup;
}

/**
 * Get warmup progress
 */
export async function getWarmupProgress(
  userId: string,
  domain: string
): Promise<WarmupProgress | null> {
  const warmup = await getDomainWarmup(userId, domain);

  if (!warmup) {
    return null;
  }

  const schedule = warmup.warmup_schedule as WarmupDay[];
  const totalDays = schedule.length;

  // Get today's sent count
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { count: todaySent } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', `${today}T00:00:00`)
    .in('status', ['sent', 'delivered', 'bounced']);

  // Calculate progress
  const progressPercentage = Math.round((warmup.current_day / totalDays) * 100);

  // Calculate estimated completion
  const daysRemaining = totalDays - warmup.current_day;
  const estimatedCompletion = new Date();
  estimatedCompletion.setDate(estimatedCompletion.getDate() + daysRemaining);

  // Check if on track
  const currentScheduleDay = schedule.find((d) => d.day === warmup.current_day);
  const expectedLimit = currentScheduleDay?.limit || warmup.current_daily_limit;
  const onTrack = (todaySent || 0) >= expectedLimit * 0.8; // 80% threshold

  return {
    domain,
    current_day: warmup.current_day,
    total_days: totalDays,
    progress_percentage: progressPercentage,
    today_limit: warmup.current_daily_limit,
    today_sent: todaySent || 0,
    remaining_today: Math.max(0, warmup.current_daily_limit - (todaySent || 0)),
    on_track: onTrack,
    estimated_completion: estimatedCompletion.toISOString().split('T')[0],
  };
}

/**
 * Advance warmup to next day
 */
export async function advanceWarmupDay(
  userId: string,
  domain: string
): Promise<DomainWarmup | null> {
  const warmup = await getDomainWarmup(userId, domain);

  if (!warmup) {
    return null;
  }

  const schedule = warmup.warmup_schedule as WarmupDay[];
  const nextDay = warmup.current_day + 1;
  const nextScheduleDay = schedule.find((d) => d.day === nextDay);

  const supabase = await createServiceClient();

  if (!nextScheduleDay) {
    // Warmup complete
    const { data, error } = await supabase
      .from('domain_warmup')
      .update({
        is_active: false,
        completed_at: new Date().toISOString(),
      })
      .eq('id', warmup.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete warmup: ${error.message}`);
    }

    return data as DomainWarmup;
  }

  // Advance to next day
  const { data, error } = await supabase
    .from('domain_warmup')
    .update({
      current_day: nextDay,
      current_daily_limit: nextScheduleDay.limit,
    })
    .eq('id', warmup.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to advance warmup: ${error.message}`);
  }

  return data as DomainWarmup;
}

/**
 * Check if sending limit is exceeded for warmup
 */
export async function checkWarmupLimit(
  userId: string,
  domain: string,
  additionalCount: number = 1
): Promise<{ allowed: boolean; limit: number; current: number; remaining: number }> {
  const progress = await getWarmupProgress(userId, domain);

  if (!progress) {
    // No active warmup, no limit
    return { allowed: true, limit: 0, current: 0, remaining: Infinity };
  }

  const wouldExceed = progress.today_sent + additionalCount > progress.today_limit;

  return {
    allowed: !wouldExceed,
    limit: progress.today_limit,
    current: progress.today_sent,
    remaining: progress.remaining_today,
  };
}

// ============================================
// ISP METRICS (Simplified)
// ============================================

interface ISPMetrics {
  isp: string;
  sent: number;
  delivered: number;
  bounced: number;
  delivery_rate: number;
}

/**
 * Get metrics broken down by ISP domain
 */
export async function getISPMetrics(
  userId: string,
  days: number = 30
): Promise<ISPMetrics[]> {
  // This is a simplified implementation
  // In production, would aggregate from messages table
  const ispDomains: Record<string, string> = {
    'gmail.com': 'Google',
    'googlemail.com': 'Google',
    'yahoo.com': 'Yahoo',
    'yahoo.co.jp': 'Yahoo Japan',
    'outlook.com': 'Microsoft',
    'hotmail.com': 'Microsoft',
    'icloud.com': 'Apple',
  };

  // This would need proper implementation with message data
  return Object.entries(ispDomains).map(([domain, isp]) => ({
    isp,
    sent: 0,
    delivered: 0,
    bounced: 0,
    delivery_rate: 0,
  }));
}

/**
 * Get reputation score
 */
export function calculateReputationScore(summary: ReputationSummary): number {
  let score = 100;

  // Delivery rate impact (up to -30)
  if (summary.avg_delivery_rate < 95) {
    score -= (95 - summary.avg_delivery_rate) * 2;
  }

  // Bounce rate impact (up to -40)
  score -= summary.avg_bounce_rate * 8;

  // Complaint rate impact (up to -30)
  score -= summary.avg_complaint_rate * 300;

  return Math.max(0, Math.min(100, Math.round(score)));
}
