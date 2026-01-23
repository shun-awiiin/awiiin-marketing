/**
 * Webhook Security - Signature verification and idempotency
 * Provides security utilities for email provider webhooks
 */

import { createServiceClient } from '@/lib/supabase/server';

// SNS Message Signature Verification
interface SNSMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
}

// Certificate cache to avoid repeated fetches
const certCache: Map<string, string> = new Map();

/**
 * Verify AWS SNS message signature
 * https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */
export async function verifySNSSignature(message: SNSMessage): Promise<boolean> {
  // In development, skip verification if disabled
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_SNS_VERIFICATION === 'true') {
    return true;
  }

  try {
    // Validate SigningCertURL is from AWS
    const certUrl = new URL(message.SigningCertURL);
    if (!certUrl.hostname.endsWith('.amazonaws.com')) {
      return false;
    }
    if (certUrl.protocol !== 'https:') {
      return false;
    }

    // Get or fetch the signing certificate
    let certPem = certCache.get(message.SigningCertURL);
    if (!certPem) {
      const certResponse = await fetch(message.SigningCertURL);
      if (!certResponse.ok) {
        return false;
      }
      certPem = await certResponse.text();
      certCache.set(message.SigningCertURL, certPem);
    }

    // Build the string to sign based on message type
    const stringToSign = buildStringToSign(message);

    // Verify the signature
    const signature = Buffer.from(message.Signature, 'base64');
    const isValid = await verifySignatureWithCert(certPem, stringToSign, signature);

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Build the string to sign for SNS message verification
 */
function buildStringToSign(message: SNSMessage): string {
  let stringToSign = '';

  if (message.Type === 'Notification') {
    stringToSign = [
      'Message', message.Message,
      'MessageId', message.MessageId,
      'Timestamp', message.Timestamp,
      'TopicArn', message.TopicArn,
      'Type', message.Type,
    ].join('\n') + '\n';
  } else if (message.Type === 'SubscriptionConfirmation' || message.Type === 'UnsubscribeConfirmation') {
    stringToSign = [
      'Message', message.Message,
      'MessageId', message.MessageId,
      'SubscribeURL', message.SubscribeURL || '',
      'Timestamp', message.Timestamp,
      'Token', (message as unknown as { Token?: string }).Token || '',
      'TopicArn', message.TopicArn,
      'Type', message.Type,
    ].join('\n') + '\n';
  }

  return stringToSign;
}

/**
 * Verify signature using certificate (Web Crypto API)
 */
async function verifySignatureWithCert(
  certPem: string,
  stringToSign: string,
  signature: Buffer
): Promise<boolean> {
  try {
    // Extract the public key from PEM certificate
    const pemLines = certPem.split('\n');
    const pemContent = pemLines
      .filter(line => !line.includes('-----'))
      .join('');
    const certDer = Buffer.from(pemContent, 'base64');

    // Import the certificate and extract public key
    // Note: This is a simplified verification - in production, use a proper crypto library
    const publicKey = await crypto.subtle.importKey(
      'spki',
      certDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      false,
      ['verify']
    );

    // Verify the signature
    const dataBuffer = new TextEncoder().encode(stringToSign);
    const signatureArray = new Uint8Array(signature);

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureArray,
      dataBuffer
    );
  } catch {
    // If Web Crypto fails, fall back to node crypto for server-side
    try {
      const crypto = await import('crypto');
      const verify = crypto.createVerify('SHA1');
      verify.update(stringToSign);
      return verify.verify(certPem, signature);
    } catch {
      return false;
    }
  }
}

/**
 * Verify SendGrid webhook signature
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
export function verifySendGridSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

  // In development, skip if no key configured
  if (!verificationKey) {
    return process.env.NODE_ENV === 'development';
  }

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const crypto = require('crypto');
    const timestampPayload = timestamp + payload;
    const expectedSignature = crypto
      .createHmac('sha256', verificationKey)
      .update(timestampPayload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verify Resend webhook signature
 * https://resend.com/docs/dashboard/webhooks/verify-webhooks
 */
export function verifyResendSignature(
  payload: string,
  signature: string | null
): boolean {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // In development, skip if no secret configured
  if (!webhookSecret) {
    return process.env.NODE_ENV === 'development';
  }

  if (!signature) {
    return false;
  }

  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Resend sends signature as svix_signature with format "v1,{signature}"
    const parts = signature.split(',');
    const signatureValue = parts.length > 1 ? parts[1] : signature;

    return crypto.timingSafeEqual(
      Buffer.from(signatureValue),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Idempotency Check
interface IdempotencyResult {
  isDuplicate: boolean;
  existingId?: string;
}

/**
 * Check if an event has already been processed (idempotency)
 * Returns true if the event is a duplicate
 */
export async function checkEventIdempotency(
  provider: string,
  messageId: string,
  eventType: string
): Promise<IdempotencyResult> {
  const supabase = await createServiceClient();

  // Check if event already exists
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .eq('provider', provider)
    .eq('provider_message_id', messageId)
    .eq('event_type', eventType)
    .single();

  if (existingEvent) {
    return { isDuplicate: true, existingId: existingEvent.id };
  }

  return { isDuplicate: false };
}

/**
 * Generate idempotency key for event
 */
export function generateIdempotencyKey(
  provider: string,
  messageId: string,
  eventType: string
): string {
  return `${provider}:${messageId}:${eventType}`;
}
