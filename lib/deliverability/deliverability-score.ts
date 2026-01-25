/**
 * Deliverability Score Service
 * Calculates comprehensive deliverability score from multiple factors
 */

import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getOverallDomainHealthScore,
  getDomainHealthRecords,
} from '@/lib/domain/domain-health';
import { getListHygieneStatus, calculateListHealthScore } from '@/lib/hygiene/list-hygiene';
import { getEngagementSummary } from '@/lib/engagement/engagement-tracker';
import { getReputationSummary, calculateReputationScore } from '@/lib/reputation/reputation-tracker';
import type {
  DeliverabilityScore,
  FactorScore,
  PrioritizedRecommendation,
  DeliverabilityDashboardData,
  DomainHealthRecord,
  DeliverabilityAlert,
} from '@/lib/types/deliverability';
import { DELIVERABILITY_WEIGHTS } from '@/lib/types/deliverability';

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Internal function to calculate deliverability score
 */
async function calculateDeliverabilityScoreInternal(
  userId: string,
  domain?: string
): Promise<DeliverabilityScore> {
  // Gather all factor scores in parallel
  const [domainHealthScore, listHygieneStatus, engagementSummary, reputationData, contentScore] =
    await Promise.all([
      getOverallDomainHealthScore(userId),
      getListHygieneStatus(userId),
      getEngagementSummary(userId),
      domain
        ? getReputationSummary(userId, domain, '30d')
        : { avg_delivery_rate: 95, avg_bounce_rate: 0, avg_complaint_rate: 0 },
      getAverageContentScore(userId),
    ]);

  // Calculate individual factor scores
  const factors: DeliverabilityScore['factors'] = {
    domain_health: calculateFactorScore(
      domainHealthScore,
      DELIVERABILITY_WEIGHTS.domain_health,
      getDomainHealthDetails(domainHealthScore)
    ),
    list_quality: calculateFactorScore(
      calculateListHealthScore(listHygieneStatus),
      DELIVERABILITY_WEIGHTS.list_quality,
      getListQualityDetails(listHygieneStatus)
    ),
    engagement: calculateFactorScore(
      engagementSummary.average_score,
      DELIVERABILITY_WEIGHTS.engagement,
      getEngagementDetails(engagementSummary)
    ),
    reputation: calculateFactorScore(
      calculateReputationScore(reputationData as Parameters<typeof calculateReputationScore>[0]),
      DELIVERABILITY_WEIGHTS.reputation,
      getReputationDetails(reputationData as Parameters<typeof calculateReputationScore>[0])
    ),
    content: calculateFactorScore(
      contentScore,
      DELIVERABILITY_WEIGHTS.content,
      getContentDetails(contentScore)
    ),
  };

  // Calculate overall score
  const overallScore = Math.round(
    factors.domain_health.weighted_score +
    factors.list_quality.weighted_score +
    factors.engagement.weighted_score +
    factors.reputation.weighted_score +
    factors.content.weighted_score
  );

  // Determine grade
  const grade = getGrade(overallScore);

  // Generate recommendations
  const recommendations = generatePrioritizedRecommendations(factors);

  return {
    overall_score: overallScore,
    grade,
    factors,
    recommendations,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Calculate comprehensive deliverability score (cached for 5 minutes)
 */
export async function calculateDeliverabilityScore(
  userId: string,
  domain?: string
): Promise<DeliverabilityScore> {
  const getCachedScore = unstable_cache(
    async () => calculateDeliverabilityScoreInternal(userId, domain),
    [`deliverability-score-${userId}-${domain || 'default'}`],
    {
      revalidate: 300, // 5 minutes
      tags: [`deliverability-${userId}`],
    }
  );

  return getCachedScore();
}

/**
 * Calculate factor score with weighted value
 */
function calculateFactorScore(
  score: number,
  weight: number,
  details: string[]
): FactorScore {
  const status = getFactorStatus(score);

  return {
    score,
    weight,
    weighted_score: Math.round(score * weight),
    status,
    details,
  };
}

/**
 * Get factor status from score
 */
function getFactorStatus(
  score: number
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

/**
 * Get grade from overall score
 */
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ============================================
// FACTOR DETAILS
// ============================================

function getDomainHealthDetails(score: number): string[] {
  const details: string[] = [];

  if (score >= 90) {
    details.push('すべてのドメイン認証が正しく設定されています');
  } else if (score >= 70) {
    details.push('一部のドメイン認証に問題があります');
  } else if (score >= 50) {
    details.push('複数のドメイン認証が未設定または不完全です');
  } else {
    details.push('ドメイン認証が適切に設定されていません');
    details.push('SPF、DKIM、DMARCの設定を確認してください');
  }

  return details;
}

function getListQualityDetails(status: ReturnType<typeof getListHygieneStatus> extends Promise<infer T> ? T : never): string[] {
  const details: string[] = [];

  details.push(`アクティブなコンタクト: ${status.active_contacts}件`);

  if (status.bounced_contacts > 0) {
    details.push(`バウンスしたコンタクト: ${status.bounced_contacts}件`);
  }

  if (status.high_risk_contacts > 0) {
    details.push(`高リスクコンタクト: ${status.high_risk_contacts}件`);
  }

  if (status.inactive_contacts > 0) {
    details.push(`非活発なコンタクト: ${status.inactive_contacts}件`);
  }

  return details;
}

function getEngagementDetails(summary: Awaited<ReturnType<typeof getEngagementSummary>>): string[] {
  const details: string[] = [];

  details.push(`平均エンゲージメントスコア: ${summary.average_score}`);
  details.push(`平均開封率: ${summary.average_open_rate}%`);
  details.push(`平均クリック率: ${summary.average_click_rate}%`);

  const engagedCount = summary.distribution.highly_engaged + summary.distribution.engaged;
  const disengagedCount = summary.distribution.disengaged + summary.distribution.inactive;

  if (engagedCount > disengagedCount) {
    details.push('コンタクトの多くがアクティブです');
  } else {
    details.push('リエンゲージメントが必要なコンタクトが多数います');
  }

  return details;
}

function getReputationDetails(summary: { avg_delivery_rate: number; avg_bounce_rate: number; avg_complaint_rate: number }): string[] {
  const details: string[] = [];

  details.push(`平均配信率: ${summary.avg_delivery_rate.toFixed(1)}%`);
  details.push(`平均バウンス率: ${summary.avg_bounce_rate.toFixed(2)}%`);
  details.push(`平均苦情率: ${summary.avg_complaint_rate.toFixed(3)}%`);

  if (summary.avg_bounce_rate >= 5) {
    details.push('バウンス率が高すぎます（目標: 5%未満）');
  }

  if (summary.avg_complaint_rate >= 0.1) {
    details.push('苦情率が高すぎます（目標: 0.1%未満）');
  }

  return details;
}

function getContentDetails(score: number): string[] {
  const details: string[] = [];

  if (score >= 90) {
    details.push('コンテンツの品質は優秀です');
  } else if (score >= 70) {
    details.push('コンテンツに軽微な問題があります');
  } else {
    details.push('コンテンツにスパムトリガーが含まれている可能性があります');
    details.push('コンテンツチェッカーで詳細を確認してください');
  }

  return details;
}

// ============================================
// RECOMMENDATIONS
// ============================================

/**
 * Generate prioritized recommendations based on factor scores
 */
function generatePrioritizedRecommendations(
  factors: DeliverabilityScore['factors']
): PrioritizedRecommendation[] {
  const recommendations: PrioritizedRecommendation[] = [];

  // Domain health recommendations (Priority 1 if critical)
  if (factors.domain_health.status === 'critical') {
    recommendations.push({
      priority: 1,
      category: 'domain_health',
      title: 'ドメイン認証を設定してください',
      description: 'SPF、DKIM、DMARCの設定が不完全です。これは配信率に大きく影響します。',
      impact: 'high',
      effort: 'medium',
      action_url: '/dashboard/deliverability/domain-health',
    });
  } else if (factors.domain_health.status === 'poor') {
    recommendations.push({
      priority: 2,
      category: 'domain_health',
      title: 'ドメイン認証を改善してください',
      description: '一部のドメイン認証が不完全です。',
      impact: 'medium',
      effort: 'medium',
      action_url: '/dashboard/deliverability/domain-health',
    });
  }

  // List quality recommendations
  if (factors.list_quality.status === 'critical' || factors.list_quality.status === 'poor') {
    recommendations.push({
      priority: 1,
      category: 'list_quality',
      title: 'コンタクトリストをクリーンアップしてください',
      description: '高リスクまたは無効なコンタクトが多数含まれています。',
      impact: 'high',
      effort: 'low',
      action_url: '/dashboard/deliverability/list-hygiene',
    });
  }

  // Engagement recommendations
  if (factors.engagement.status === 'critical') {
    recommendations.push({
      priority: 2,
      category: 'engagement',
      title: 'リエンゲージメントキャンペーンを検討してください',
      description: 'エンゲージメントが低いコンタクトが多数います。',
      impact: 'medium',
      effort: 'medium',
      action_url: '/dashboard/deliverability/list-hygiene',
    });
  } else if (factors.engagement.status === 'poor') {
    recommendations.push({
      priority: 3,
      category: 'engagement',
      title: 'コンテンツの関連性を向上させてください',
      description: '開封率やクリック率を改善するため、パーソナライゼーションを強化してください。',
      impact: 'medium',
      effort: 'medium',
    });
  }

  // Reputation recommendations
  if (factors.reputation.status === 'critical') {
    recommendations.push({
      priority: 1,
      category: 'reputation',
      title: '送信を一時停止して原因を調査してください',
      description: 'バウンス率または苦情率が危険な水準です。',
      impact: 'high',
      effort: 'high',
      action_url: '/dashboard/deliverability/reputation',
    });
  } else if (factors.reputation.status === 'poor') {
    recommendations.push({
      priority: 2,
      category: 'reputation',
      title: '送信頻度とコンテンツを見直してください',
      description: 'バウンス率または苦情率が高めです。',
      impact: 'high',
      effort: 'medium',
      action_url: '/dashboard/deliverability/reputation',
    });
  }

  // Content recommendations
  if (factors.content.status === 'poor' || factors.content.status === 'critical') {
    recommendations.push({
      priority: 2,
      category: 'content',
      title: 'メールコンテンツを改善してください',
      description: 'スパムフィルターにかかりやすいコンテンツが含まれています。',
      impact: 'medium',
      effort: 'low',
    });
  }

  // Sort by priority
  return recommendations.sort((a, b) => a.priority - b.priority);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get average content score from recent checks
 */
async function getAverageContentScore(userId: string): Promise<number> {
  try {
    const supabase = await createServiceClient();

    const { data } = await supabase
      .from('content_checks')
      .select('overall_score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) {
      return 75; // Default score if no checks
    }

    return Math.round(data.reduce((sum, c) => sum + c.overall_score, 0) / data.length);
  } catch {
    return 75;
  }
}

// ============================================
// DASHBOARD DATA
// ============================================

/**
 * Get all data needed for deliverability dashboard
 */
export async function getDeliverabilityDashboardData(
  userId: string,
  domain?: string
): Promise<DeliverabilityDashboardData> {
  const [score, domainHealth, listHygiene, reputation, warmup, alerts] = await Promise.all([
    calculateDeliverabilityScore(userId, domain),
    getDomainHealthRecords(userId),
    getListHygieneStatus(userId),
    domain
      ? getReputationSummary(userId, domain, '30d')
      : { domain: '', period: '30d' as const, total_sent: 0, avg_delivery_rate: 0, avg_bounce_rate: 0, avg_complaint_rate: 0, avg_open_rate: 0, avg_click_rate: 0, trend: { delivery_rate: 'stable' as const, bounce_rate: 'stable' as const, complaint_rate: 'stable' as const }, risk_level: 'healthy' as const, daily_metrics: [] },
    getWarmupProgressForUser(userId, domain),
    getActiveAlerts(userId),
  ]);

  return {
    score,
    domain_health: domainHealth,
    list_hygiene: listHygiene,
    reputation,
    warmup,
    alerts,
  };
}

/**
 * Get warmup progress for user
 */
async function getWarmupProgressForUser(
  userId: string,
  domain?: string
): Promise<DeliverabilityDashboardData['warmup']> {
  if (!domain) return null;

  try {
    const { getWarmupProgress } = await import('@/lib/reputation/reputation-tracker');
    return await getWarmupProgress(userId, domain);
  } catch {
    return null;
  }
}

/**
 * Get active alerts for user
 */
async function getActiveAlerts(userId: string): Promise<DeliverabilityAlert[]> {
  try {
    const supabase = await createServiceClient();

    const { data } = await supabase
      .from('deliverability_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    return (data || []) as DeliverabilityAlert[];
  } catch {
    return [];
  }
}

/**
 * Create a deliverability alert
 */
export async function createAlert(
  userId: string,
  alert: Omit<DeliverabilityAlert, 'id' | 'user_id' | 'is_read' | 'is_dismissed' | 'created_at'>
): Promise<DeliverabilityAlert> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('deliverability_alerts')
    .insert({
      user_id: userId,
      ...alert,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create alert: ${error.message}`);
  }

  return data as DeliverabilityAlert;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(userId: string, alertId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('deliverability_alerts')
    .update({ is_dismissed: true })
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to dismiss alert: ${error.message}`);
  }
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(userId: string, alertId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('deliverability_alerts')
    .update({ is_read: true })
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to mark alert as read: ${error.message}`);
  }
}
