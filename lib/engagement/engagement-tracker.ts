/**
 * Engagement Tracker Service
 * Tracks and calculates contact engagement scores and levels
 */

import { createServiceClient } from '@/lib/supabase/server';
import type {
  ContactEngagement,
  EngagementSummary,
  EngagementUpdateEvent,
  EngagementLevel,
} from '@/lib/types/deliverability';
import { ENGAGEMENT_THRESHOLDS } from '@/lib/types/deliverability';

// ============================================
// ENGAGEMENT SCORE CALCULATION
// ============================================

interface EngagementFactors {
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  lastOpenAt: Date | null;
  lastClickAt: Date | null;
}

/**
 * Calculate engagement score based on various factors
 * Returns score from 0 (inactive) to 100 (highly engaged)
 */
export function calculateEngagementScore(factors: EngagementFactors): number {
  let score = 50; // Start with neutral score

  const { totalSent, totalOpens, totalClicks, lastOpenAt, lastClickAt } = factors;

  // Calculate rates
  const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

  // Open rate contribution (max 30 points)
  // Average open rate is around 20%, excellent is 40%+
  score += Math.min(30, openRate * 1.5);

  // Click rate contribution (max 20 points)
  // Average click rate is around 2-3%, excellent is 5%+
  score += Math.min(20, clickRate * 4);

  // Recency bonus/penalty
  const now = new Date();
  const lastEngagement = getLatestDate(lastOpenAt, lastClickAt);

  if (lastEngagement) {
    const daysSinceEngagement = Math.floor(
      (now.getTime() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceEngagement <= 7) {
      score += 15; // Very recent engagement
    } else if (daysSinceEngagement <= 30) {
      score += 10; // Recent engagement
    } else if (daysSinceEngagement <= 90) {
      score += 5; // Moderate recency
    } else if (daysSinceEngagement > 180) {
      score -= 20; // Long time without engagement
    }
  } else if (totalSent > 0) {
    // Sent emails but never opened/clicked
    score -= 15;
  }

  // Volume penalty for no engagement
  if (totalSent >= 5 && totalOpens === 0) {
    score -= 10; // Multiple sends with no opens
  }

  // Clamp score to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Determine engagement level from score
 */
export function getEngagementLevel(score: number): EngagementLevel {
  if (score >= ENGAGEMENT_THRESHOLDS.highly_engaged) {
    return 'highly_engaged';
  } else if (score >= ENGAGEMENT_THRESHOLDS.engaged) {
    return 'engaged';
  } else if (score >= ENGAGEMENT_THRESHOLDS.neutral) {
    return 'neutral';
  } else if (score >= ENGAGEMENT_THRESHOLDS.disengaged) {
    return 'disengaged';
  } else {
    return 'inactive';
  }
}

// ============================================
// EVENT PROCESSING
// ============================================

/**
 * Process an open event and update engagement
 */
export async function processOpenEvent(event: EngagementUpdateEvent): Promise<void> {
  const supabase = await createServiceClient();

  // Update message
  await supabase
    .from('messages')
    .update({
      opened_at: event.occurred_at,
      open_count: supabase.rpc ? 1 : 1, // Increment handled by trigger or manual
    })
    .eq('id', event.message_id)
    .is('opened_at', null); // Only update if first open

  // Get current contact data
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, total_opens, total_clicks, total_sent, last_open_at, last_click_at')
    .eq('id', event.contact_id)
    .single();

  if (!contact) return;

  // Calculate new engagement
  const newTotalOpens = (contact.total_opens || 0) + 1;
  const newScore = calculateEngagementScore({
    totalSent: contact.total_sent || 0,
    totalOpens: newTotalOpens,
    totalClicks: contact.total_clicks || 0,
    lastOpenAt: new Date(event.occurred_at),
    lastClickAt: contact.last_click_at ? new Date(contact.last_click_at) : null,
  });

  // Update contact
  await supabase
    .from('contacts')
    .update({
      total_opens: newTotalOpens,
      last_open_at: event.occurred_at,
      engagement_score: newScore,
      engagement_level: getEngagementLevel(newScore),
    })
    .eq('id', event.contact_id);
}

/**
 * Process a click event and update engagement
 */
export async function processClickEvent(event: EngagementUpdateEvent): Promise<void> {
  const supabase = await createServiceClient();

  // Update message
  const { data: message } = await supabase
    .from('messages')
    .select('clicked_at')
    .eq('id', event.message_id)
    .single();

  await supabase
    .from('messages')
    .update({
      clicked_at: message?.clicked_at || event.occurred_at,
      click_count: (message as { click_count?: number })?.click_count
        ? ((message as { click_count: number }).click_count + 1)
        : 1,
    })
    .eq('id', event.message_id);

  // Get current contact data
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, total_opens, total_clicks, total_sent, last_open_at, last_click_at')
    .eq('id', event.contact_id)
    .single();

  if (!contact) return;

  // Calculate new engagement
  const newTotalClicks = (contact.total_clicks || 0) + 1;
  const newScore = calculateEngagementScore({
    totalSent: contact.total_sent || 0,
    totalOpens: contact.total_opens || 0,
    totalClicks: newTotalClicks,
    lastOpenAt: contact.last_open_at ? new Date(contact.last_open_at) : null,
    lastClickAt: new Date(event.occurred_at),
  });

  // Update contact
  await supabase
    .from('contacts')
    .update({
      total_clicks: newTotalClicks,
      last_click_at: event.occurred_at,
      engagement_score: newScore,
      engagement_level: getEngagementLevel(newScore),
    })
    .eq('id', event.contact_id);
}

/**
 * Increment total_sent for a contact
 */
export async function incrementSentCount(contactId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { data: contact } = await supabase
    .from('contacts')
    .select('total_sent')
    .eq('id', contactId)
    .single();

  if (contact) {
    await supabase
      .from('contacts')
      .update({
        total_sent: (contact.total_sent || 0) + 1,
      })
      .eq('id', contactId);
  }
}

// ============================================
// DATA RETRIEVAL
// ============================================

/**
 * Get engagement data for all contacts
 */
export async function getContactEngagements(
  userId: string,
  options: {
    level?: EngagementLevel;
    minScore?: number;
    maxScore?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<ContactEngagement[]> {
  const supabase = await createServiceClient();

  let query = supabase
    .from('contacts')
    .select(`
      id,
      email,
      first_name,
      engagement_score,
      engagement_level,
      total_sent,
      total_opens,
      total_clicks,
      last_open_at,
      last_click_at
    `)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (options.level) {
    query = query.eq('engagement_level', options.level);
  }

  if (options.minScore !== undefined) {
    query = query.gte('engagement_score', options.minScore);
  }

  if (options.maxScore !== undefined) {
    query = query.lte('engagement_score', options.maxScore);
  }

  query = query.order('engagement_score', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get contact engagements: ${error.message}`);
  }

  return (data || []).map((contact) => ({
    contact_id: contact.id,
    email: contact.email,
    first_name: contact.first_name,
    engagement_score: contact.engagement_score || 50,
    engagement_level: contact.engagement_level || 'neutral',
    total_sent: contact.total_sent || 0,
    total_opens: contact.total_opens || 0,
    total_clicks: contact.total_clicks || 0,
    open_rate: contact.total_sent > 0
      ? Math.round((contact.total_opens / contact.total_sent) * 100 * 10) / 10
      : 0,
    click_rate: contact.total_sent > 0
      ? Math.round((contact.total_clicks / contact.total_sent) * 100 * 10) / 10
      : 0,
    last_open_at: contact.last_open_at,
    last_click_at: contact.last_click_at,
    last_sent_at: null, // Would need to join with messages
  }));
}

/**
 * Get engagement summary for user
 */
export async function getEngagementSummary(userId: string): Promise<EngagementSummary> {
  const supabase = await createServiceClient();

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('engagement_score, engagement_level, total_opens, total_clicks, total_sent')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to get engagement summary: ${error.message}`);
  }

  const distribution = {
    highly_engaged: 0,
    engaged: 0,
    neutral: 0,
    disengaged: 0,
    inactive: 0,
  };

  let totalScore = 0;
  let totalOpens = 0;
  let totalClicks = 0;
  let totalSent = 0;

  for (const contact of contacts || []) {
    const level = (contact.engagement_level as EngagementLevel) || 'neutral';
    distribution[level]++;
    totalScore += contact.engagement_score || 50;
    totalOpens += contact.total_opens || 0;
    totalClicks += contact.total_clicks || 0;
    totalSent += contact.total_sent || 0;
  }

  const totalContacts = contacts?.length || 0;

  return {
    total_contacts: totalContacts,
    distribution,
    average_score: totalContacts > 0 ? Math.round(totalScore / totalContacts) : 50,
    average_open_rate: totalSent > 0 ? Math.round((totalOpens / totalSent) * 100 * 10) / 10 : 0,
    average_click_rate: totalSent > 0 ? Math.round((totalClicks / totalSent) * 100 * 10) / 10 : 0,
  };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Recalculate engagement scores for all contacts
 */
export async function recalculateAllEngagementScores(userId: string): Promise<number> {
  const supabase = await createServiceClient();

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, total_sent, total_opens, total_clicks, last_open_at, last_click_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to get contacts: ${error.message}`);
  }

  let updated = 0;

  for (const contact of contacts || []) {
    const newScore = calculateEngagementScore({
      totalSent: contact.total_sent || 0,
      totalOpens: contact.total_opens || 0,
      totalClicks: contact.total_clicks || 0,
      lastOpenAt: contact.last_open_at ? new Date(contact.last_open_at) : null,
      lastClickAt: contact.last_click_at ? new Date(contact.last_click_at) : null,
    });

    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        engagement_score: newScore,
        engagement_level: getEngagementLevel(newScore),
      })
      .eq('id', contact.id);

    if (!updateError) {
      updated++;
    }
  }

  return updated;
}

/**
 * Get contacts that need re-engagement
 */
export async function getContactsForReengagement(
  userId: string,
  maxDaysSinceEngagement: number = 90
): Promise<ContactEngagement[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDaysSinceEngagement);

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id,
      email,
      first_name,
      engagement_score,
      engagement_level,
      total_sent,
      total_opens,
      total_clicks,
      last_open_at,
      last_click_at
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('engagement_level', ['disengaged', 'inactive'])
    .or(`last_open_at.lt.${cutoffDate.toISOString()},last_open_at.is.null`)
    .order('engagement_score', { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`Failed to get contacts for reengagement: ${error.message}`);
  }

  return (data || []).map((contact) => ({
    contact_id: contact.id,
    email: contact.email,
    first_name: contact.first_name,
    engagement_score: contact.engagement_score || 0,
    engagement_level: contact.engagement_level || 'inactive',
    total_sent: contact.total_sent || 0,
    total_opens: contact.total_opens || 0,
    total_clicks: contact.total_clicks || 0,
    open_rate: contact.total_sent > 0
      ? Math.round((contact.total_opens / contact.total_sent) * 100 * 10) / 10
      : 0,
    click_rate: contact.total_sent > 0
      ? Math.round((contact.total_clicks / contact.total_sent) * 100 * 10) / 10
      : 0,
    last_open_at: contact.last_open_at,
    last_click_at: contact.last_click_at,
    last_sent_at: null,
  }));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getLatestDate(date1: Date | null, date2: Date | null): Date | null {
  if (!date1 && !date2) return null;
  if (!date1) return date2;
  if (!date2) return date1;
  return date1 > date2 ? date1 : date2;
}

/**
 * Get engagement level display info
 */
export function getEngagementLevelInfo(level: EngagementLevel): {
  label: string;
  color: string;
  description: string;
} {
  const levelInfo: Record<EngagementLevel, { label: string; color: string; description: string }> = {
    highly_engaged: {
      label: '非常に活発',
      color: 'green',
      description: 'メールを頻繁に開封し、リンクをクリックしています',
    },
    engaged: {
      label: '活発',
      color: 'blue',
      description: 'メールを定期的に開封しています',
    },
    neutral: {
      label: '普通',
      color: 'gray',
      description: '平均的なエンゲージメントです',
    },
    disengaged: {
      label: '低調',
      color: 'yellow',
      description: 'メールをあまり開封していません',
    },
    inactive: {
      label: '非活発',
      color: 'red',
      description: '長期間メールを開封していません',
    },
  };

  return levelInfo[level];
}
