/**
 * Scheduled Send Service
 * Handles scheduled campaign processing for cron jobs
 */

import { createClient } from '@/lib/supabase/server';
import type { Campaign, ScheduledSendResult } from '@/lib/types/database';

export class ScheduledSendError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ScheduledSendError';
    this.code = code;
  }
}

interface ScheduledCampaign {
  id: string;
  name: string;
  scheduled_at: string;
  status: string;
  user_id: string;
  template_id: string;
}

interface ProcessResult {
  campaign_id: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Find campaigns that are due for scheduled sending
 * Returns campaigns with scheduled_at <= now and status = 'scheduled'
 */
export async function findScheduledCampaigns(
  limit: number = 10
): Promise<ScheduledCampaign[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name, scheduled_at, status, user_id, template_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(limit);

  if (error) {
    throw new ScheduledSendError(
      `Failed to fetch scheduled campaigns: ${error.message}`,
      'FETCH_FAILED'
    );
  }

  return data || [];
}

/**
 * Mark campaign as processing (queued status)
 */
export async function markCampaignAsProcessing(
  campaignId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('campaigns')
    .update({
      status: 'queued',
      started_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (error) {
    throw new ScheduledSendError(
      `Failed to mark campaign as processing: ${error.message}`,
      'UPDATE_FAILED'
    );
  }
}

/**
 * Revert campaign status on failure
 */
export async function revertCampaignStatus(
  campaignId: string,
  errorMessage: string
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('campaigns')
    .update({
      status: 'scheduled',
      stop_reason: `自動送信失敗: ${errorMessage}`,
    })
    .eq('id', campaignId);
}

/**
 * Process a single scheduled campaign
 */
export async function processScheduledCampaign(
  campaign: ScheduledCampaign
): Promise<ProcessResult> {
  try {
    // Mark as processing first to prevent double-processing
    await markCampaignAsProcessing(campaign.id);

    // Get base URL for API calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Call the queue endpoint to start sending
    // Note: This is an internal server-to-server call
    // The queue endpoint should verify the cron secret for internal calls
    const cronSecret = process.env.CRON_SECRET;
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use cron secret for internal API calls authentication
        ...(cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {}),
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      // Revert status on failure
      await revertCampaignStatus(campaign.id, result.error || 'Queue failed');
      return {
        campaign_id: campaign.id,
        status: 'failed',
        error: result.error || 'Failed to queue campaign',
      };
    }

    return {
      campaign_id: campaign.id,
      status: 'success',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await revertCampaignStatus(campaign.id, errorMessage);
    return {
      campaign_id: campaign.id,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Process all due scheduled campaigns
 */
export async function processScheduledCampaigns(): Promise<ScheduledSendResult> {
  const campaigns = await findScheduledCampaigns();

  if (campaigns.length === 0) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      jobs: [],
    };
  }

  const results = await Promise.all(
    campaigns.map((campaign) => processScheduledCampaign(campaign))
  );

  const succeeded = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return {
    processed: campaigns.length,
    succeeded,
    failed,
    jobs: results,
  };
}

/**
 * Verify cron secret for security
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }

  if (!cronSecret) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}
