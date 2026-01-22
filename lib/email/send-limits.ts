/**
 * 送信制限チェック
 * - 初回ドメイン制限: 200通/日 × 7日間
 * - 通常制限: rate_limit_per_minute に従う
 */

import { createClient } from '@/lib/supabase/server';
import { RATE_LIMITS } from '@/lib/types/database';

export interface SendLimitStatus {
  canSend: boolean;
  isInitialPeriod: boolean;
  dailyLimit: number;
  dailySent: number;
  remainingToday: number;
  daysRemaining: number;
  reason?: string;
}

/**
 * ドメインの送信開始日を取得または設定
 */
async function getDomainStartDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fromEmail: string
): Promise<Date | null> {
  const domain = fromEmail.split('@')[1];

  // domain_send_stats テーブルから取得（なければ作成）
  const { data: stats } = await supabase
    .from('domain_send_stats')
    .select('first_send_at')
    .eq('user_id', userId)
    .eq('domain', domain)
    .single();

  if (stats?.first_send_at) {
    return new Date(stats.first_send_at);
  }

  return null;
}

/**
 * ドメインの送信開始日を記録
 */
export async function recordDomainFirstSend(
  userId: string,
  fromEmail: string
): Promise<void> {
  const supabase = await createClient();
  const domain = fromEmail.split('@')[1];

  await supabase
    .from('domain_send_stats')
    .upsert({
      user_id: userId,
      domain,
      first_send_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,domain',
      ignoreDuplicates: true,
    });
}

/**
 * 今日の送信数を取得
 */
async function getTodaySentCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', todayStart.toISOString())
    .in('status', ['sent', 'delivered', 'bounced', 'complained'])
    .eq('campaign_id', (
      // サブクエリでuser_idのキャンペーンのみ
      await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', userId)
    ).data?.map(c => c.id) || []);

  return count ?? 0;
}

/**
 * 送信制限ステータスをチェック
 */
export async function checkSendLimits(
  userId: string,
  fromEmail: string
): Promise<SendLimitStatus> {
  const supabase = await createClient();

  // ドメインの送信開始日を取得
  const firstSendDate = await getDomainStartDate(supabase, userId, fromEmail);

  // 今日の送信数を取得
  const dailySent = await getTodaySentCount(supabase, userId);

  // 初回期間かどうかを判定
  const now = new Date();
  let isInitialPeriod = true;
  let daysRemaining = RATE_LIMITS.INITIAL_PERIOD_DAYS;

  if (firstSendDate) {
    const daysSinceFirst = Math.floor(
      (now.getTime() - firstSendDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    isInitialPeriod = daysSinceFirst < RATE_LIMITS.INITIAL_PERIOD_DAYS;
    daysRemaining = Math.max(0, RATE_LIMITS.INITIAL_PERIOD_DAYS - daysSinceFirst);
  }

  // 日次制限を決定
  const dailyLimit = isInitialPeriod
    ? RATE_LIMITS.INITIAL_DAILY_LIMIT
    : Infinity; // 初回期間後は日次制限なし（分速制限のみ）

  const remainingToday = Math.max(0, dailyLimit - dailySent);
  const canSend = remainingToday > 0;

  let reason: string | undefined;
  if (!canSend) {
    reason = isInitialPeriod
      ? `初回期間中の日次制限（${RATE_LIMITS.INITIAL_DAILY_LIMIT}通/日）に達しました。明日まで送信できません。`
      : '送信制限に達しました。';
  }

  return {
    canSend,
    isInitialPeriod,
    dailyLimit: isInitialPeriod ? dailyLimit : -1, // -1 = 無制限
    dailySent,
    remainingToday: isInitialPeriod ? remainingToday : -1,
    daysRemaining,
    reason,
  };
}

/**
 * キャンペーン送信前の制限チェック
 * @returns エラーメッセージ（問題なければnull）
 */
export async function validateSendLimits(
  userId: string,
  fromEmail: string,
  messageCount: number
): Promise<string | null> {
  const status = await checkSendLimits(userId, fromEmail);

  if (!status.canSend) {
    return status.reason || '送信制限に達しています。';
  }

  if (status.isInitialPeriod && messageCount > status.remainingToday) {
    return `初回期間中のため、本日は残り${status.remainingToday}通まで送信可能です。送信予定${messageCount}通を${status.remainingToday}通に減らすか、明日以降に送信してください。`;
  }

  return null;
}
