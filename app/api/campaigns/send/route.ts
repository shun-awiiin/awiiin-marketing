import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AUTO_STOP_THRESHOLDS } from '@/lib/types/database';

// Send rate limits
const DEFAULT_RATE_PER_MINUTE = 20;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [30000, 120000, 600000]; // 30s, 2min, 10min

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

// POST /api/campaigns/send - Background send processor
export async function POST(request: NextRequest) {
  try {
    const { campaignId } = await request.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Check if campaign is in sendable state
    if (!['queued', 'sending'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Campaign is not in sendable state' },
        { status: 400 }
      );
    }

    // Update to sending status
    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // Process messages
    const ratePerMinute = campaign.rate_limit_per_minute || DEFAULT_RATE_PER_MINUTE;
    const intervalMs = Math.ceil(60000 / ratePerMinute);
    let sentCount = 0;
    let failedCount = 0;
    let consecutiveFailures = 0;

    while (true) {
      // Check if campaign was paused/stopped
      const { data: currentCampaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();

      if (!currentCampaign || !['queued', 'sending'].includes(currentCampaign.status)) {
        console.log(`Campaign ${campaignId} was stopped/paused`);
        break;
      }

      // Get next queued message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (messageError || !message) {
        // No more messages to send
        break;
      }

      // Mark as sending
      await supabase
        .from('messages')
        .update({ status: 'sending' })
        .eq('id', message.id);

      // Send the email
      const result = await sendEmail(
        message.to_email,
        message.subject,
        message.body_text,
        campaign.from_name,
        campaign.from_email
      );

      if (result.success) {
        sentCount++;
        consecutiveFailures = 0;

        await supabase
          .from('messages')
          .update({
            status: 'sent',
            provider_message_id: result.messageId,
            sent_at: new Date().toISOString()
          })
          .eq('id', message.id);

        // Log event
        await supabase.from('events').insert({
          provider: getProvider(),
          provider_message_id: result.messageId,
          event_type: 'send',
          email: message.to_email,
          campaign_id: campaignId,
          occurred_at: new Date().toISOString()
        });
      } else {
        // Handle failure
        const newRetryCount = message.retry_count + 1;

        if (result.retryable && newRetryCount <= MAX_RETRIES) {
          // Schedule retry
          await supabase
            .from('messages')
            .update({
              status: 'queued',
              retry_count: newRetryCount,
              last_error: result.error
            })
            .eq('id', message.id);

          // Wait before retry
          await sleep(RETRY_DELAYS[newRetryCount - 1] || 30000);
        } else {
          failedCount++;
          consecutiveFailures++;

          await supabase
            .from('messages')
            .update({
              status: 'failed',
              last_error: result.error
            })
            .eq('id', message.id);
        }
      }

      // Check auto-stop conditions
      const shouldStop = await checkAutoStopConditions(supabase, campaignId, consecutiveFailures);

      if (shouldStop.stop) {
        await supabase
          .from('campaigns')
          .update({
            status: 'stopped',
            stop_reason: shouldStop.reason,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);

        console.log(`Campaign ${campaignId} auto-stopped: ${shouldStop.reason}`);
        break;
      }

      // Rate limit delay
      await sleep(intervalMs);
    }

    // Check if completed
    const { count: remainingCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'sending']);

    if (remainingCount === 0) {
      const { data: finalCampaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();

      if (finalCampaign?.status === 'sending') {
        await supabase
          .from('campaigns')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
      }
    }

    return NextResponse.json({
      message: 'Send process completed',
      sent: sentCount,
      failed: failedCount
    });
  } catch (error) {
    console.error('Send process error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Check auto-stop conditions
async function checkAutoStopConditions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  consecutiveFailures: number
): Promise<{ stop: boolean; reason?: string }> {
  // Check consecutive failures
  if (consecutiveFailures >= AUTO_STOP_THRESHOLDS.CONSECUTIVE_FAILURES) {
    return {
      stop: true,
      reason: `${consecutiveFailures}件連続で送信に失敗しました`
    };
  }

  // Get stats
  const { data: messages } = await supabase
    .from('messages')
    .select('status')
    .eq('campaign_id', campaignId);

  if (!messages || messages.length < 20) {
    // Not enough data to check rates
    return { stop: false };
  }

  const total = messages.filter(m =>
    ['sent', 'delivered', 'bounced', 'complained'].includes(m.status)
  ).length;

  if (total === 0) return { stop: false };

  const bounced = messages.filter(m => m.status === 'bounced').length;
  const complained = messages.filter(m => m.status === 'complained').length;

  const bounceRate = (bounced / total) * 100;
  const complaintRate = (complained / total) * 100;

  // Check bounce rate
  if (bounceRate >= AUTO_STOP_THRESHOLDS.BOUNCE_RATE_PERCENT) {
    return {
      stop: true,
      reason: `バウンス率が${bounceRate.toFixed(2)}%に達しました（閾値: ${AUTO_STOP_THRESHOLDS.BOUNCE_RATE_PERCENT}%）`
    };
  }

  // Check complaint rate
  if (complaintRate >= AUTO_STOP_THRESHOLDS.COMPLAINT_RATE_PERCENT) {
    return {
      stop: true,
      reason: `苦情率が${complaintRate.toFixed(2)}%に達しました（閾値: ${AUTO_STOP_THRESHOLDS.COMPLAINT_RATE_PERCENT}%）`
    };
  }

  return { stop: false };
}

// Get current email provider
function getProvider(): 'ses' | 'resend' | 'sendgrid' {
  const provider = process.env.EMAIL_PROVIDER || 'mock';
  if (provider === 'ses') return 'ses';
  if (provider === 'resend') return 'resend';
  if (provider === 'sendgrid') return 'sendgrid';
  return 'ses'; // default
}

// Send email via configured provider
async function sendEmail(
  to: string,
  subject: string,
  text: string,
  fromName: string,
  fromEmail: string
): Promise<SendResult> {
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  switch (provider) {
    case 'ses':
      return await sendWithSES(to, subject, text, fromName, fromEmail);
    case 'resend':
      return await sendWithResend(to, subject, text, fromName, fromEmail);
    case 'sendgrid':
      return await sendWithSendGrid(to, subject, text, fromName, fromEmail);
    default:
      // Mock for development
      console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
      return {
        success: true,
        messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`
      };
  }
}

// Send with AWS SES
async function sendWithSES(
  to: string,
  subject: string,
  text: string,
  fromName: string,
  fromEmail: string
): Promise<SendResult> {
  // Using SES v2 API via HTTP (no SDK dependency)
  const region = process.env.AWS_REGION || 'ap-northeast-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return { success: false, error: 'AWS credentials not configured', retryable: false };
  }

  try {
    const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;
    const body = JSON.stringify({
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' } }
        }
      },
      Destination: { ToAddresses: [to] },
      FromEmailAddress: `${fromName} <${fromEmail}>`
    });

    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = date.substring(0, 8);

    // Create AWS Signature v4 (simplified - in production use AWS SDK)
    const { signature, headers } = await signAWSRequest(
      'POST',
      endpoint,
      body,
      region,
      accessKeyId,
      secretAccessKey,
      date,
      dateStamp
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Authorization': signature
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isRetryable = response.status >= 500 || response.status === 429;
      return { success: false, error: errorText, retryable: isRetryable };
    }

    const result = await response.json();
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    return { success: false, error: String(error), retryable: true };
  }
}

// AWS Signature V4 (simplified)
async function signAWSRequest(
  method: string,
  url: string,
  body: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  date: string,
  dateStamp: string
): Promise<{ signature: string; headers: Record<string, string> }> {
  const service = 'ses';
  const host = new URL(url).host;

  const headers: Record<string, string> = {
    'Host': host,
    'X-Amz-Date': date
  };

  // Create canonical request
  const signedHeaders = Object.keys(headers).sort().join(';').toLowerCase();
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k.toLowerCase()}:${v}`)
    .join('\n') + '\n';

  const payloadHash = await sha256(body);
  const canonicalRequest = [
    method,
    new URL(url).pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    date,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');

  // Calculate signature
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureHex = await hmacSha256Hex(kSigning, stringToSign);

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return { signature: authorization, headers };
}

// Crypto helpers
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmacSha256(key, message);
  return Array.from(new Uint8Array(result))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Send with Resend
async function sendWithResend(
  to: string,
  subject: string,
  text: string,
  fromName: string,
  fromEmail: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Resend API key not configured', retryable: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      const isRetryable = response.status >= 500 || response.status === 429;
      return { success: false, error: error.message || 'Unknown error', retryable: isRetryable };
    }

    const result = await response.json();
    return { success: true, messageId: result.id };
  } catch (error) {
    return { success: false, error: String(error), retryable: true };
  }
}

// Send with SendGrid
async function sendWithSendGrid(
  to: string,
  subject: string,
  text: string,
  fromName: string,
  fromEmail: string
): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'SendGrid API key not configured', retryable: false };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: 'text/plain', value: text }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isRetryable = response.status >= 500 || response.status === 429;
      return { success: false, error: errorText, retryable: isRetryable };
    }

    // SendGrid returns message ID in header
    const messageId = response.headers.get('X-Message-Id') || `sg-${Date.now()}`;
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: String(error), retryable: true };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
