/**
 * List Hygiene Service
 * Manages contact list quality, identifies problematic contacts,
 * and provides suppression/cleanup functionality
 */

import { createServiceClient } from '@/lib/supabase/server';
import type {
  ListHygieneStatus,
  ListHygieneRecommendation,
  SuppressRequest,
  SuppressResult,
  EmailRiskLevel,
  EngagementLevel,
} from '@/lib/types/deliverability';

// ============================================
// LIST STATUS AND ANALYSIS
// ============================================

/**
 * Get comprehensive list hygiene status
 */
export async function getListHygieneStatus(userId: string): Promise<ListHygieneStatus> {
  const supabase = await createServiceClient();

  // Get contact counts by status
  const [
    totalResult,
    activeResult,
    bouncedResult,
    complainedResult,
    unsubscribedResult,
    highRiskResult,
    inactiveResult,
  ] = await Promise.all([
    // Total contacts
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    // Active contacts
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
    // Bounced contacts
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'bounced'),
    // Complained contacts
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'complained'),
    // Unsubscribed contacts
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'unsubscribed'),
    // High risk contacts (validation_status = high or critical)
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('validation_status', ['high', 'critical']),
    // Inactive contacts (engagement_level = inactive or disengaged)
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('engagement_level', ['inactive', 'disengaged']),
  ]);

  const total = totalResult.count ?? 0;
  const active = activeResult.count ?? 0;
  const bounced = bouncedResult.count ?? 0;
  const complained = complainedResult.count ?? 0;
  const unsubscribed = unsubscribedResult.count ?? 0;
  const highRisk = highRiskResult.count ?? 0;
  const inactive = inactiveResult.count ?? 0;

  // Calculate health percentage
  const healthPercentage = total > 0
    ? Math.round(((active - highRisk - inactive) / total) * 100)
    : 100;

  // Generate recommendations
  const recommendations = generateHygieneRecommendations({
    total,
    active,
    bounced,
    complained,
    unsubscribed,
    highRisk,
    inactive,
  });

  return {
    total_contacts: total,
    active_contacts: active,
    bounced_contacts: bounced,
    complained_contacts: complained,
    unsubscribed_contacts: unsubscribed,
    high_risk_contacts: highRisk,
    inactive_contacts: inactive,
    health_percentage: Math.max(0, Math.min(100, healthPercentage)),
    recommendations,
  };
}

/**
 * Generate recommendations based on list status
 */
function generateHygieneRecommendations(stats: {
  total: number;
  active: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  highRisk: number;
  inactive: number;
}): ListHygieneRecommendation[] {
  const recommendations: ListHygieneRecommendation[] = [];

  // High-risk contacts recommendation
  if (stats.highRisk > 0) {
    const riskPercentage = (stats.highRisk / stats.total) * 100;
    recommendations.push({
      type: 'suppress',
      contact_count: stats.highRisk,
      description: `${stats.highRisk}件の高リスクメールアドレスを抑制することを推奨します`,
      impact: riskPercentage > 5 ? 'high' : riskPercentage > 2 ? 'medium' : 'low',
    });
  }

  // Inactive contacts recommendation
  if (stats.inactive > 0) {
    const inactivePercentage = (stats.inactive / stats.total) * 100;
    if (inactivePercentage > 20) {
      recommendations.push({
        type: 'reengage',
        contact_count: stats.inactive,
        description: `${stats.inactive}件の非活発なコンタクトにリエンゲージメントキャンペーンを送信することを推奨します`,
        impact: 'high',
      });
    } else {
      recommendations.push({
        type: 'reengage',
        contact_count: stats.inactive,
        description: `${stats.inactive}件の非活発なコンタクトがあります。リエンゲージメントを検討してください`,
        impact: 'medium',
      });
    }
  }

  // Bounced contacts - clean up
  if (stats.bounced > 0) {
    recommendations.push({
      type: 'clean',
      contact_count: stats.bounced,
      description: `${stats.bounced}件のバウンスしたコンタクトがリストから除外されています`,
      impact: 'low',
    });
  }

  // Complained contacts - high priority
  if (stats.complained > 0) {
    recommendations.push({
      type: 'clean',
      contact_count: stats.complained,
      description: `${stats.complained}件の苦情を報告したコンタクトがリストから除外されています`,
      impact: 'high',
    });
  }

  // Revalidation recommendation
  const activeWithoutValidation = stats.active - stats.highRisk;
  if (stats.total > 100 && stats.highRisk === 0) {
    recommendations.push({
      type: 'revalidate',
      contact_count: stats.active,
      description: 'コンタクトリストを定期的に検証して、配信品質を維持することを推奨します',
      impact: 'medium',
    });
  }

  return recommendations;
}

// ============================================
// CONTACT SUPPRESSION
// ============================================

/**
 * Suppress contacts based on criteria
 */
export async function suppressContacts(
  userId: string,
  request: SuppressRequest
): Promise<SuppressResult> {
  const supabase = await createServiceClient();

  // Build query based on criteria
  let query = supabase
    .from('contacts')
    .select('id, email')
    .eq('user_id', userId)
    .eq('status', 'active');

  const reasons: Map<string, string> = new Map();

  // Apply risk level filter
  if (request.criteria.risk_level && request.criteria.risk_level.length > 0) {
    query = query.in('validation_status', request.criteria.risk_level);
    request.criteria.risk_level.forEach((level) => {
      reasons.set(`risk_${level}`, `Validation risk: ${level}`);
    });
  }

  // Apply engagement level filter
  if (request.criteria.engagement_level && request.criteria.engagement_level.length > 0) {
    query = query.in('engagement_level', request.criteria.engagement_level);
    request.criteria.engagement_level.forEach((level) => {
      reasons.set(`engagement_${level}`, `Engagement: ${level}`);
    });
  }

  // Apply inactive days filter
  if (request.criteria.inactive_days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - request.criteria.inactive_days);
    query = query.or(`last_open_at.lt.${cutoffDate.toISOString()},last_open_at.is.null`);
    reasons.set('inactive', `Inactive for ${request.criteria.inactive_days}+ days`);
  }

  // Apply bounced filter
  if (request.criteria.bounced) {
    query = query.gt('soft_bounce_count', 0);
    reasons.set('bounced', 'Has soft bounces');
  }

  const { data: contacts, error } = await query.limit(1000);

  if (error) {
    throw new Error(`Failed to query contacts: ${error.message}`);
  }

  const contactsToSuppress = contacts || [];

  // If dry run, return preview
  if (request.dry_run) {
    return {
      suppressed_count: contactsToSuppress.length,
      contacts: contactsToSuppress.map((c) => ({
        id: c.id,
        email: c.email,
        reason: Array.from(reasons.values()).join(', ') || 'Matched criteria',
      })),
    };
  }

  // Actually suppress contacts (update status)
  const contactIds = contactsToSuppress.map((c) => c.id);

  if (contactIds.length > 0) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ status: 'unsubscribed' })
      .in('id', contactIds);

    if (updateError) {
      throw new Error(`Failed to suppress contacts: ${updateError.message}`);
    }
  }

  return {
    suppressed_count: contactsToSuppress.length,
    contacts: contactsToSuppress.map((c) => ({
      id: c.id,
      email: c.email,
      reason: Array.from(reasons.values()).join(', ') || 'Matched criteria',
    })),
  };
}

// ============================================
// PROBLEMATIC CONTACTS QUERIES
// ============================================

/**
 * Get contacts with soft bounces
 */
export async function getContactsWithSoftBounces(
  userId: string,
  minBounces: number = 1
): Promise<Array<{ id: string; email: string; soft_bounce_count: number }>> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, soft_bounce_count')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('soft_bounce_count', minBounces)
    .order('soft_bounce_count', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to get contacts with soft bounces: ${error.message}`);
  }

  return data || [];
}

/**
 * Get recently bounced contacts
 */
export async function getRecentlyBouncedContacts(
  userId: string,
  days: number = 30
): Promise<Array<{ id: string; email: string; status: string; updated_at: string }>> {
  const supabase = await createServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, status, updated_at')
    .eq('user_id', userId)
    .eq('status', 'bounced')
    .gte('updated_at', cutoffDate.toISOString())
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to get recently bounced contacts: ${error.message}`);
  }

  return data || [];
}

/**
 * Get contacts that haven't opened emails in X days
 */
export async function getStaleContacts(
  userId: string,
  days: number = 90
): Promise<Array<{
  id: string;
  email: string;
  last_open_at: string | null;
  total_sent: number;
}>> {
  const supabase = await createServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, last_open_at, total_sent')
    .eq('user_id', userId)
    .eq('status', 'active')
    .or(`last_open_at.lt.${cutoffDate.toISOString()},last_open_at.is.null`)
    .gt('total_sent', 0)
    .order('last_open_at', { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) {
    throw new Error(`Failed to get stale contacts: ${error.message}`);
  }

  return data || [];
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Reactivate contacts that have been inactive
 */
export async function reactivateContacts(
  userId: string,
  contactIds: string[]
): Promise<number> {
  if (contactIds.length === 0) return 0;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('contacts')
    .update({
      status: 'active',
      engagement_score: 50,
      engagement_level: 'neutral',
    })
    .eq('user_id', userId)
    .in('id', contactIds)
    .in('status', ['unsubscribed'])
    .select('id');

  if (error) {
    throw new Error(`Failed to reactivate contacts: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Mark contacts for re-engagement campaign
 */
export async function tagForReengagement(
  userId: string,
  tagName: string = 'リエンゲージメント対象'
): Promise<{ tagId: string; contactCount: number }> {
  const supabase = await createServiceClient();

  // Create or get the tag
  let tagId: string;

  const { data: existingTag } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .eq('name', tagName)
    .single();

  if (existingTag) {
    tagId = existingTag.id;
  } else {
    const { data: newTag, error } = await supabase
      .from('tags')
      .insert({
        user_id: userId,
        name: tagName,
        color: '#F59E0B', // Orange color
      })
      .select('id')
      .single();

    if (error || !newTag) {
      throw new Error(`Failed to create tag: ${error?.message}`);
    }
    tagId = newTag.id;
  }

  // Get inactive/disengaged contacts
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('engagement_level', ['inactive', 'disengaged'])
    .limit(500);

  if (contactsError) {
    throw new Error(`Failed to get contacts: ${contactsError.message}`);
  }

  // Add tags to contacts
  const contactIds = contacts?.map((c) => c.id) || [];

  if (contactIds.length > 0) {
    const tagAssignments = contactIds.map((contactId) => ({
      contact_id: contactId,
      tag_id: tagId,
    }));

    await supabase
      .from('contact_tags')
      .upsert(tagAssignments, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });
  }

  return {
    tagId,
    contactCount: contactIds.length,
  };
}

// ============================================
// CLEANUP OPERATIONS
// ============================================

/**
 * Remove duplicate contacts (keep the oldest one)
 */
export async function findDuplicateContacts(
  userId: string
): Promise<Array<{ email: string; count: number; ids: string[] }>> {
  const supabase = await createServiceClient();

  // Get all contacts grouped by email
  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get contacts: ${error.message}`);
  }

  // Find duplicates
  const emailMap = new Map<string, string[]>();
  for (const contact of data || []) {
    const email = contact.email.toLowerCase();
    if (!emailMap.has(email)) {
      emailMap.set(email, []);
    }
    emailMap.get(email)!.push(contact.id);
  }

  // Return only duplicates
  const duplicates: Array<{ email: string; count: number; ids: string[] }> = [];
  for (const [email, ids] of emailMap) {
    if (ids.length > 1) {
      duplicates.push({
        email,
        count: ids.length,
        ids,
      });
    }
  }

  return duplicates;
}

/**
 * Get list health score
 */
export function calculateListHealthScore(status: ListHygieneStatus): number {
  const {
    total_contacts,
    active_contacts,
    bounced_contacts,
    complained_contacts,
    high_risk_contacts,
    inactive_contacts,
  } = status;

  if (total_contacts === 0) return 100;

  let score = 100;

  // Bounce rate penalty (up to -30 points)
  const bounceRate = bounced_contacts / total_contacts;
  score -= Math.min(30, bounceRate * 100 * 6);

  // Complaint rate penalty (up to -40 points)
  const complaintRate = complained_contacts / total_contacts;
  score -= Math.min(40, complaintRate * 100 * 40);

  // High risk penalty (up to -15 points)
  const highRiskRate = high_risk_contacts / active_contacts;
  score -= Math.min(15, highRiskRate * 100 * 3);

  // Inactive penalty (up to -15 points)
  const inactiveRate = inactive_contacts / active_contacts;
  score -= Math.min(15, inactiveRate * 100 * 0.75);

  return Math.max(0, Math.min(100, Math.round(score)));
}
