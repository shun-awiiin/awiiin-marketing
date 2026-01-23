/**
 * Test Send Service
 * Handles test email sending for campaigns before bulk sending
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from './email-sender';
import {
  renderTemplate,
  generateSubject,
  buildContext,
  generateEmailBody,
} from './template-renderer';
import {
  type Campaign,
  type Template,
  type TestSendRequest,
  type TestSendResult,
  TestSendRequestSchema,
  TEST_SEND_RATE_LIMIT,
  DEFAULT_FIRST_NAME,
} from '@/lib/types/database';

export class TestSendError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TestSendError';
    this.code = code;
  }
}

interface ValidationResult {
  success: boolean;
  data?: TestSendRequest;
  error?: string;
}

/**
 * Validate test send request using Zod schema
 */
export function validateTestSendRequest(input: unknown): ValidationResult {
  const result = TestSendRequestSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Validation failed',
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt?: Date;
}

/**
 * Check if test send is within rate limit
 * Limit: 5 test sends per hour per campaign
 */
export async function checkTestSendRateLimit(
  campaignId: string
): Promise<RateLimitResult> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - TEST_SEND_RATE_LIMIT.WINDOW_MS);

  const { count } = await supabase
    .from('test_sends')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', windowStart.toISOString());

  const currentCount = count || 0;
  const remaining = Math.max(0, TEST_SEND_RATE_LIMIT.MAX_PER_HOUR - currentCount);
  const allowed = currentCount < TEST_SEND_RATE_LIMIT.MAX_PER_HOUR;

  return {
    allowed,
    remaining,
    resetAt: allowed ? undefined : new Date(Date.now() + TEST_SEND_RATE_LIMIT.WINDOW_MS),
  };
}

interface EmailPreview {
  subject: string;
  body_text: string;
  from: string;
  to?: string;
}

/**
 * Generate test email preview with sample data
 */
export function generateTestEmailPreview(
  campaign: Campaign,
  template: Template,
  subjectIndex: number = 0,
  sampleFirstName?: string
): EmailPreview {
  const firstName = sampleFirstName || DEFAULT_FIRST_NAME;
  const context = buildContext(campaign.type, campaign.input_payload, firstName);

  // Generate subject with [TEST] prefix
  const rawSubject = generateSubject(campaign.type, subjectIndex, firstName);
  const subject = `[TEST] ${rawSubject}`;

  // Generate body with test unsubscribe link
  const body_text = generateEmailBody(
    template.body_text,
    context,
    '[TEST - 配信停止リンク]'
  );

  return {
    subject,
    body_text,
    from: `${campaign.from_name} <${campaign.from_email}>`,
  };
}

/**
 * Send a test email for a campaign
 */
export async function sendTestEmail(
  campaign: Campaign,
  template: Template,
  request: TestSendRequest,
  userId: string,
  subjectIndex: number = 0
): Promise<TestSendResult> {
  const supabase = await createClient();

  // Check rate limit
  const rateLimit = await checkTestSendRateLimit(campaign.id);
  if (!rateLimit.allowed) {
    throw new TestSendError(
      `テスト送信の上限に達しました。${TEST_SEND_RATE_LIMIT.MAX_PER_HOUR}回/時間まで送信可能です。`,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  // Generate preview
  const preview = generateTestEmailPreview(
    campaign,
    template,
    subjectIndex,
    request.sample_first_name
  );

  // Send the email
  const result = await sendEmail({
    to: request.recipient_email,
    subject: preview.subject,
    text: preview.body_text,
    fromName: campaign.from_name,
    fromEmail: campaign.from_email,
  });

  // Log test send
  await supabase.from('test_sends').insert({
    campaign_id: campaign.id,
    user_id: userId,
    recipient_email: request.recipient_email,
    subject: preview.subject,
    success: result.success,
    message_id: result.messageId,
    error: result.error,
  });

  if (!result.success) {
    throw new TestSendError(
      result.error || 'テスト送信に失敗しました',
      'SEND_FAILED'
    );
  }

  return {
    success: true,
    message_id: result.messageId,
    preview: {
      ...preview,
      to: request.recipient_email,
    },
  };
}

/**
 * Get campaign with template for test send
 */
export async function getCampaignForTestSend(
  campaignId: string,
  userId: string
): Promise<{ campaign: Campaign; template: Template } | null> {
  const supabase = await createClient();

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*, templates(*)')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single();

  if (campaignError || !campaign) {
    return null;
  }

  // Check if campaign is in testable state
  const testableStates = ['draft', 'scheduled', 'paused'];
  if (!testableStates.includes(campaign.status)) {
    return null;
  }

  return {
    campaign: campaign as Campaign,
    template: campaign.templates as Template,
  };
}
