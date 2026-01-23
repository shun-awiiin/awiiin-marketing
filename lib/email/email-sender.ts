/**
 * Email Sender - Unified email sending interface
 * Extracts common email sending logic from send/route.ts
 */

import { checkSuppression, type SuppressionReason } from './suppression-check';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
  suppressed?: boolean;
  suppressionReason?: SuppressionReason;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  fromName: string;
  fromEmail: string;
}

type EmailProvider = 'ses' | 'resend' | 'sendgrid' | 'mock';

/**
 * Get current email provider from environment
 */
export function getProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'mock';
  if (provider === 'ses') return 'ses';
  if (provider === 'resend') return 'resend';
  if (provider === 'sendgrid') return 'sendgrid';
  return 'mock';
}

/**
 * Send email via configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const provider = getProvider();

  switch (provider) {
    case 'ses':
      return await sendWithSES(options);
    case 'resend':
      return await sendWithResend(options);
    case 'sendgrid':
      return await sendWithSendGrid(options);
    default:
      return await sendWithMock(options);
  }
}

/**
 * Mock email sender for development/testing
 */
async function sendWithMock(options: EmailOptions): Promise<SendResult> {
  // In test environment, just return success
  return {
    success: true,
    messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}

/**
 * Send with Resend
 */
async function sendWithResend(options: EmailOptions): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Resend API key not configured', retryable: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${options.fromName} <${options.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
      }),
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

/**
 * Send with SendGrid
 */
async function sendWithSendGrid(options: EmailOptions): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'SendGrid API key not configured', retryable: false };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: options.fromEmail, name: options.fromName },
        subject: options.subject,
        content: [{ type: 'text/plain', value: options.text }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isRetryable = response.status >= 500 || response.status === 429;
      return { success: false, error: errorText, retryable: isRetryable };
    }

    const messageId = response.headers.get('X-Message-Id') || `sg-${Date.now()}`;
    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: String(error), retryable: true };
  }
}

/**
 * Send with AWS SES
 */
async function sendWithSES(options: EmailOptions): Promise<SendResult> {
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
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: options.text, Charset: 'UTF-8' } },
        },
      },
      Destination: { ToAddresses: [options.to] },
      FromEmailAddress: `${options.fromName} <${options.fromEmail}>`,
    });

    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = date.substring(0, 8);

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
        'Authorization': signature,
      },
      body,
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

// AWS Signature V4 helpers
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
    'X-Amz-Date': date,
  };

  const signedHeaders = Object.keys(headers).sort().join(';').toLowerCase();
  const canonicalHeaders =
    Object.entries(headers)
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
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    date,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureHex = await hmacSha256Hex(kSigning, stringToSign);

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return { signature: authorization, headers };
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
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
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Send email with suppression check
 * Checks if the recipient is suppressed before sending
 */
export async function sendEmailWithSuppressionCheck(
  options: EmailOptions
): Promise<SendResult> {
  // Check if recipient is suppressed
  const suppressionResult = await checkSuppression(options.to);

  if (suppressionResult.isSuppressed) {
    return {
      success: false,
      error: `Recipient is suppressed: ${suppressionResult.reason}`,
      suppressed: true,
      suppressionReason: suppressionResult.reason,
      retryable: false,
    };
  }

  // Proceed with sending
  return await sendEmail(options);
}
