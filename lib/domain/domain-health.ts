/**
 * Domain Health Service
 * Provides comprehensive domain authentication verification and recommendations
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  checkDomainAuthentication,
  lookupSPF,
  lookupDKIM,
  lookupDMARC,
  findDKIMSelector,
} from '@/lib/validation/dns-lookup';
import type {
  DomainHealthRecord,
  DomainHealthCheckResult,
  DomainRecommendation,
  AuthStatus,
} from '@/lib/types/deliverability';

// ============================================
// DOMAIN HEALTH CHECK
// ============================================

/**
 * Perform a full domain health check
 */
export async function checkDomainHealth(
  domain: string,
  dkimSelector?: string
): Promise<DomainHealthCheckResult> {
  // Run all DNS lookups in parallel
  const [spfResult, dkimResult, dmarcResult] = await Promise.all([
    lookupSPF(domain),
    dkimSelector
      ? lookupDKIM(domain, dkimSelector)
      : findDKIMSelector(domain),
    lookupDMARC(domain),
  ]);

  const recommendations: DomainRecommendation[] = [];
  let healthScore = 100;

  // Process SPF results
  if (spfResult.status === 'fail') {
    healthScore -= 30;
    recommendations.push({
      category: 'spf',
      severity: 'critical',
      title: 'SPFレコードがありません',
      description: 'SPFレコードを設定して、承認された送信サーバーを指定してください。',
      action: `v=spf1 include:_spf.google.com ~all のようなSPFレコードをDNSに追加してください`,
    });
  } else if (spfResult.status === 'partial') {
    healthScore -= 10;
    recommendations.push({
      category: 'spf',
      severity: 'warning',
      title: 'SPFポリシーを強化してください',
      description: 'SPFレコードで "-all" を使用することを推奨します。',
      action: 'SPFレコードの末尾を "~all" から "-all" に変更してください',
    });
  }

  // Process DKIM results
  const dkim = dkimResult || {
    status: 'fail' as AuthStatus,
    selector: 'unknown',
    record: null,
    details: ['DKIMセレクターが見つかりませんでした'],
    publicKey: null,
  };

  if (dkim.status === 'fail') {
    healthScore -= 30;
    recommendations.push({
      category: 'dkim',
      severity: 'critical',
      title: 'DKIMが設定されていません',
      description: 'DKIMを設定して、メールの署名と認証を有効にしてください。',
      action: 'メールプロバイダーの指示に従ってDKIMキーを生成し、DNSに追加してください',
    });
  }

  // Process DMARC results
  if (dmarcResult.status === 'fail') {
    healthScore -= 25;
    recommendations.push({
      category: 'dmarc',
      severity: 'critical',
      title: 'DMARCレコードがありません',
      description: 'DMARCを設定して、メール認証ポリシーを公開してください。',
      action: `_dmarc.${domain} に "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}" を追加してください`,
    });
  } else if (dmarcResult.policy === 'none') {
    healthScore -= 10;
    recommendations.push({
      category: 'dmarc',
      severity: 'warning',
      title: 'DMARCポリシーを強化してください',
      description: 'DMARCポリシーが "none" (監視のみ) に設定されています。',
      action: 'p=none を p=quarantine または p=reject に変更してください',
    });
  }

  // Check for reporting
  if (dmarcResult.status !== 'fail' && !dmarcResult.parsed.rua) {
    recommendations.push({
      category: 'dmarc',
      severity: 'info',
      title: 'DMARCレポートを有効にしてください',
      description: 'DMARCレポートを受信して、認証の問題を監視できます。',
      action: 'rua=mailto:dmarc-reports@yourdomain.com をDMARCレコードに追加してください',
    });
  }

  // General recommendations
  if (healthScore === 100) {
    recommendations.push({
      category: 'general',
      severity: 'info',
      title: 'ドメイン認証は正常です',
      description: 'SPF、DKIM、DMARCがすべて正しく設定されています。',
    });
  }

  return {
    domain,
    spf: {
      status: spfResult.status,
      record: spfResult.record,
      details: spfResult.details,
    },
    dkim: {
      status: dkim.status,
      selector: dkim.selector,
      record: dkim.record,
      details: dkim.details,
    },
    dmarc: {
      status: dmarcResult.status,
      record: dmarcResult.record,
      policy: dmarcResult.policy,
      details: dmarcResult.details,
    },
    health_score: Math.max(0, healthScore),
    recommendations,
  };
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Save or update domain health record
 */
export async function saveDomainHealth(
  userId: string,
  checkResult: DomainHealthCheckResult
): Promise<DomainHealthRecord> {
  const supabase = await createServiceClient();

  const record = {
    user_id: userId,
    domain: checkResult.domain,
    spf_status: checkResult.spf.status,
    spf_record: checkResult.spf.record,
    dkim_status: checkResult.dkim.status,
    dkim_selector: checkResult.dkim.selector,
    dkim_record: checkResult.dkim.record,
    dmarc_status: checkResult.dmarc.status,
    dmarc_record: checkResult.dmarc.record,
    dmarc_policy: checkResult.dmarc.policy,
    health_score: checkResult.health_score,
    recommendations: checkResult.recommendations,
    last_checked_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('domain_health')
    .upsert(record, { onConflict: 'user_id,domain' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save domain health: ${error.message}`);
  }

  return data as DomainHealthRecord;
}

/**
 * Get domain health records for a user
 */
export async function getDomainHealthRecords(
  userId: string
): Promise<DomainHealthRecord[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('domain_health')
    .select('*')
    .eq('user_id', userId)
    .order('health_score', { ascending: true });

  if (error) {
    throw new Error(`Failed to get domain health records: ${error.message}`);
  }

  return data as DomainHealthRecord[];
}

/**
 * Get domain health record by domain
 */
export async function getDomainHealthByDomain(
  userId: string,
  domain: string
): Promise<DomainHealthRecord | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('domain_health')
    .select('*')
    .eq('user_id', userId)
    .eq('domain', domain)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get domain health: ${error.message}`);
  }

  return data as DomainHealthRecord;
}

/**
 * Delete domain health record
 */
export async function deleteDomainHealth(
  userId: string,
  domain: string
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('domain_health')
    .delete()
    .eq('user_id', userId)
    .eq('domain', domain);

  if (error) {
    throw new Error(`Failed to delete domain health: ${error.message}`);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract domain from email address
 */
export function extractDomainFromEmail(email: string): string {
  const parts = email.split('@');
  return parts[1] || '';
}

/**
 * Get unique sending domains from user's campaigns
 */
export async function getUserSendingDomains(userId: string): Promise<string[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select('from_email')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to get sending domains: ${error.message}`);
  }

  const domains = new Set<string>();
  data?.forEach((campaign) => {
    const domain = extractDomainFromEmail(campaign.from_email);
    if (domain) {
      domains.add(domain);
    }
  });

  return Array.from(domains);
}

/**
 * Check and update all user domains
 */
export async function checkAllUserDomains(userId: string): Promise<DomainHealthRecord[]> {
  const domains = await getUserSendingDomains(userId);
  const results: DomainHealthRecord[] = [];

  for (const domain of domains) {
    const checkResult = await checkDomainHealth(domain);
    const saved = await saveDomainHealth(userId, checkResult);
    results.push(saved);
  }

  return results;
}

/**
 * Get overall domain health score for user
 */
export async function getOverallDomainHealthScore(userId: string): Promise<number> {
  const records = await getDomainHealthRecords(userId);

  if (records.length === 0) {
    return 0;
  }

  const totalScore = records.reduce((sum, r) => sum + r.health_score, 0);
  return Math.round(totalScore / records.length);
}

/**
 * Check if domain needs re-verification (older than 24 hours)
 */
export function needsRecheck(record: DomainHealthRecord): boolean {
  const lastChecked = new Date(record.last_checked_at);
  const now = new Date();
  const hoursSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
  return hoursSinceCheck > 24;
}
