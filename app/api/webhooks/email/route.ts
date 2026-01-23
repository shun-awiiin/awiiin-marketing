import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processOpenEvent, processClickEvent } from '@/lib/engagement/engagement-tracker';
import {
  verifySNSSignature,
  verifySendGridSignature,
  verifyResendSignature,
  checkEventIdempotency,
} from '@/lib/email/webhook-security';

// SNS Message types
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

// SES Event types
interface SESBounce {
  bounceType: 'Permanent' | 'Transient' | 'Undetermined';
  bounceSubType: string;
  bouncedRecipients: Array<{ emailAddress: string }>;
  timestamp: string;
}

interface SESComplaint {
  complainedRecipients: Array<{ emailAddress: string }>;
  timestamp: string;
  complaintFeedbackType?: string;
}

interface SESDelivery {
  timestamp: string;
  recipients: string[];
}

interface SESOpen {
  timestamp: string;
  userAgent: string;
  ipAddress: string;
}

interface SESClick {
  timestamp: string;
  link: string;
  linkTags?: Record<string, string[]>;
  userAgent: string;
  ipAddress: string;
}

interface SESEvent {
  eventType: 'Bounce' | 'Complaint' | 'Delivery' | 'Send' | 'Reject' | 'Open' | 'Click';
  mail: {
    messageId: string;
    destination: string[];
    source: string;
    timestamp: string;
  };
  bounce?: SESBounce;
  complaint?: SESComplaint;
  delivery?: SESDelivery;
  open?: SESOpen;
  click?: SESClick;
}

// POST /api/webhooks/email - Handle email provider webhooks
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const rawBody = await request.text();

    // Handle SNS subscription confirmation
    const snsMessageType = request.headers.get('x-amz-sns-message-type');

    if (snsMessageType === 'SubscriptionConfirmation') {
      const snsMessage = JSON.parse(rawBody) as SNSMessage;

      // Verify SNS signature before confirming
      const isValidSignature = await verifySNSSignature(snsMessage);
      if (!isValidSignature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Auto-confirm subscription by visiting the SubscribeURL
      if (snsMessage.SubscribeURL) {
        await fetch(snsMessage.SubscribeURL);
      }
      return NextResponse.json({ received: true });
    }

    let events: Array<Record<string, unknown>> = [];
    let provider: 'ses' | 'sendgrid' | 'resend' | 'unknown' = 'unknown';

    // Parse based on content type / provider
    if (snsMessageType === 'Notification') {
      // AWS SNS/SES notification
      const snsMessage = JSON.parse(rawBody) as SNSMessage;

      // Verify SNS signature
      const isValidSignature = await verifySNSSignature(snsMessage);
      if (!isValidSignature) {
        return NextResponse.json({ error: 'Invalid SNS signature' }, { status: 401 });
      }

      const sesEvent = JSON.parse(snsMessage.Message) as SESEvent;
      events = [sesEvent as unknown as Record<string, unknown>];
      provider = 'ses';
    } else if (contentType.includes('application/json')) {
      const body = JSON.parse(rawBody);

      // Detect provider and verify signature
      if (request.headers.get('x-twilio-email-event-webhook-signature')) {
        // SendGrid webhook
        const signature = request.headers.get('x-twilio-email-event-webhook-signature');
        const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');

        if (!verifySendGridSignature(rawBody, signature, timestamp)) {
          return NextResponse.json({ error: 'Invalid SendGrid signature' }, { status: 401 });
        }
        provider = 'sendgrid';
      } else if (request.headers.get('svix-signature')) {
        // Resend webhook
        const signature = request.headers.get('svix-signature');

        if (!verifyResendSignature(rawBody, signature)) {
          return NextResponse.json({ error: 'Invalid Resend signature' }, { status: 401 });
        }
        provider = 'resend';
      }

      // Handle array of events (SendGrid style) or single event (Resend style)
      events = Array.isArray(body) ? body : [body];
    }

    const supabase = await createServiceClient();

    for (const event of events) {
      await processEvent(supabase, event, provider);
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: Record<string, unknown>,
  detectedProvider: 'ses' | 'sendgrid' | 'resend' | 'unknown'
) {
  // Detect provider and process accordingly
  if (event.eventType || detectedProvider === 'ses') {
    // SES event format
    const sesEvent = event as unknown as SESEvent;

    // Idempotency check
    const idempotency = await checkEventIdempotency(
      'ses',
      sesEvent.mail.messageId,
      sesEvent.eventType.toLowerCase()
    );
    if (idempotency.isDuplicate) {
      return; // Skip duplicate event
    }

    await processSESEvent(supabase, sesEvent);
  } else if (event.event || detectedProvider === 'sendgrid') {
    // SendGrid event format
    const sgMessageId = event.sg_message_id as string;
    const eventType = event.event as string;

    // Idempotency check
    if (sgMessageId && eventType) {
      const idempotency = await checkEventIdempotency('sendgrid', sgMessageId, eventType);
      if (idempotency.isDuplicate) {
        return; // Skip duplicate event
      }
    }

    await processSendGridEvent(supabase, event);
  } else if (event.type || detectedProvider === 'resend') {
    // Resend event format
    const data = event.data as { email_id?: string };
    const eventType = event.type as string;

    // Idempotency check
    if (data?.email_id && eventType) {
      const idempotency = await checkEventIdempotency('resend', data.email_id, eventType);
      if (idempotency.isDuplicate) {
        return; // Skip duplicate event
      }
    }

    await processResendEvent(supabase, event);
  }
}

// Process SES events
async function processSESEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: SESEvent
) {
  const messageId = event.mail.messageId;
  const eventType = event.eventType;
  const timestamp = event.mail.timestamp;

  // Log event
  await supabase.from('events').insert({
    provider: 'ses',
    provider_message_id: messageId,
    event_type: eventType.toLowerCase(),
    email: event.mail.destination[0],
    payload: event as unknown as Record<string, unknown>,
    occurred_at: timestamp
  });

  // Find message by provider_message_id
  const { data: message } = await supabase
    .from('messages')
    .select('id, campaign_id, contact_id, to_email')
    .eq('provider_message_id', messageId)
    .single();

  switch (eventType) {
    case 'Delivery':
      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'delivered',
            delivered_at: event.delivery?.timestamp || new Date().toISOString()
          })
          .eq('id', message.id);
      }
      break;

    case 'Bounce':
      const bounceEmail = event.bounce?.bouncedRecipients[0]?.emailAddress;
      const isHardBounce = event.bounce?.bounceType === 'Permanent';

      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'bounced',
            bounced_at: event.bounce?.timestamp || new Date().toISOString(),
            last_error: `${event.bounce?.bounceType}: ${event.bounce?.bounceSubType}`
          })
          .eq('id', message.id);
      }

      // Update contact status for hard bounces
      if (bounceEmail && isHardBounce) {
        await supabase
          .from('contacts')
          .update({ status: 'bounced' })
          .eq('email', bounceEmail.toLowerCase());
      } else if (bounceEmail) {
        // Increment soft bounce count
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, soft_bounce_count')
          .eq('email', bounceEmail.toLowerCase())
          .single();

        if (contact) {
          const newCount = (contact.soft_bounce_count || 0) + 1;
          if (newCount >= 3) {
            // Convert to hard bounce after 3 soft bounces
            await supabase
              .from('contacts')
              .update({ status: 'bounced', soft_bounce_count: newCount })
              .eq('id', contact.id);
          } else {
            await supabase
              .from('contacts')
              .update({ soft_bounce_count: newCount })
              .eq('id', contact.id);
          }
        }
      }
      break;

    case 'Complaint':
      const complainEmail = event.complaint?.complainedRecipients[0]?.emailAddress;

      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'complained',
            last_error: `Complaint: ${event.complaint?.complaintFeedbackType || 'abuse'}`
          })
          .eq('id', message.id);
      }

      // Update contact status and add to unsubscribes
      if (complainEmail) {
        await supabase
          .from('contacts')
          .update({ status: 'complained' })
          .eq('email', complainEmail.toLowerCase());

        await supabase
          .from('unsubscribes')
          .upsert({
            email: complainEmail.toLowerCase(),
            reason: 'Spam complaint'
          }, { onConflict: 'email' });
      }
      break;

    case 'Open':
      if (message) {
        const openTimestamp = event.open?.timestamp || new Date().toISOString();

        // Update message open tracking
        await supabase
          .from('messages')
          .update({
            opened_at: openTimestamp,
            open_count: 1, // Will be incremented by trigger or manual logic
          })
          .eq('id', message.id)
          .is('opened_at', null); // Only set opened_at if first open

        // Increment open_count for subsequent opens
        const { data: currentMessage } = await supabase
          .from('messages')
          .select('open_count')
          .eq('id', message.id)
          .single();

        if (currentMessage) {
          await supabase
            .from('messages')
            .update({ open_count: (currentMessage.open_count || 0) + 1 })
            .eq('id', message.id);
        }

        // Process engagement update
        try {
          await processOpenEvent({
            contact_id: message.contact_id,
            event_type: 'open',
            message_id: message.id,
            campaign_id: message.campaign_id,
            occurred_at: openTimestamp,
          });
        } catch {
          // Engagement tracking failure should not block webhook processing
        }
      }
      break;

    case 'Click':
      if (message) {
        const clickTimestamp = event.click?.timestamp || new Date().toISOString();

        // Update message click tracking
        const { data: msgForClick } = await supabase
          .from('messages')
          .select('clicked_at, click_count')
          .eq('id', message.id)
          .single();

        await supabase
          .from('messages')
          .update({
            clicked_at: msgForClick?.clicked_at || clickTimestamp,
            click_count: (msgForClick?.click_count || 0) + 1,
          })
          .eq('id', message.id);

        // Process engagement update
        try {
          await processClickEvent({
            contact_id: message.contact_id,
            event_type: 'click',
            message_id: message.id,
            campaign_id: message.campaign_id,
            occurred_at: clickTimestamp,
          });
        } catch {
          // Engagement tracking failure should not block webhook processing
        }
      }
      break;
  }
}

// Process SendGrid events
async function processSendGridEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: Record<string, unknown>
) {
  const email = event.email as string;
  const eventType = event.event as string;
  const sgMessageId = event.sg_message_id as string;
  const timestamp = event.timestamp as number;

  // Log event
  await supabase.from('events').insert({
    provider: 'sendgrid',
    provider_message_id: sgMessageId,
    event_type: eventType,
    email,
    payload: event,
    occurred_at: new Date(timestamp * 1000).toISOString()
  });

  // Find message
  const { data: message } = await supabase
    .from('messages')
    .select('id')
    .eq('provider_message_id', sgMessageId)
    .single();

  switch (eventType) {
    case 'delivered':
      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'delivered',
            delivered_at: new Date(timestamp * 1000).toISOString()
          })
          .eq('id', message.id);
      }
      break;

    case 'bounce':
    case 'dropped':
      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'bounced',
            bounced_at: new Date(timestamp * 1000).toISOString(),
            last_error: event.reason as string || 'Bounced'
          })
          .eq('id', message.id);
      }

      await supabase
        .from('contacts')
        .update({ status: 'bounced' })
        .eq('email', email.toLowerCase());
      break;

    case 'spamreport':
      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'complained'
          })
          .eq('id', message.id);
      }

      await supabase
        .from('contacts')
        .update({ status: 'complained' })
        .eq('email', email.toLowerCase());

      await supabase
        .from('unsubscribes')
        .upsert({ email: email.toLowerCase(), reason: 'Spam report' }, { onConflict: 'email' });
      break;

    case 'unsubscribe':
      await supabase
        .from('contacts')
        .update({ status: 'unsubscribed' })
        .eq('email', email.toLowerCase());

      await supabase
        .from('unsubscribes')
        .upsert({ email: email.toLowerCase(), reason: 'Unsubscribed via provider' }, { onConflict: 'email' });
      break;

    case 'open':
      if (message) {
        const openTime = new Date(timestamp * 1000).toISOString();

        // Get message details for engagement tracking
        const { data: msgDetail } = await supabase
          .from('messages')
          .select('contact_id, campaign_id, open_count')
          .eq('id', message.id)
          .single();

        await supabase
          .from('messages')
          .update({
            opened_at: openTime,
            open_count: (msgDetail?.open_count || 0) + 1,
          })
          .eq('id', message.id);

        if (msgDetail) {
          try {
            await processOpenEvent({
              contact_id: msgDetail.contact_id,
              event_type: 'open',
              message_id: message.id,
              campaign_id: msgDetail.campaign_id,
              occurred_at: openTime,
            });
          } catch {
            // Engagement tracking failure should not block webhook processing
          }
        }
      }
      break;

    case 'click':
      if (message) {
        const clickTime = new Date(timestamp * 1000).toISOString();

        const { data: msgDetailClick } = await supabase
          .from('messages')
          .select('contact_id, campaign_id, clicked_at, click_count')
          .eq('id', message.id)
          .single();

        await supabase
          .from('messages')
          .update({
            clicked_at: msgDetailClick?.clicked_at || clickTime,
            click_count: (msgDetailClick?.click_count || 0) + 1,
          })
          .eq('id', message.id);

        if (msgDetailClick) {
          try {
            await processClickEvent({
              contact_id: msgDetailClick.contact_id,
              event_type: 'click',
              message_id: message.id,
              campaign_id: msgDetailClick.campaign_id,
              occurred_at: clickTime,
            });
          } catch {
            // Engagement tracking failure should not block webhook processing
          }
        }
      }
      break;
  }
}

// Process Resend events
async function processResendEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: Record<string, unknown>
) {
  const eventType = event.type as string;
  const data = event.data as { email_id?: string; to?: string[]; email?: { to?: string[] } };
  const emailId = data?.email_id;
  const toEmail = data?.to?.[0] || data?.email?.to?.[0];
  const createdAt = event.created_at as string;

  // Log event
  await supabase.from('events').insert({
    provider: 'resend',
    provider_message_id: emailId,
    event_type: eventType,
    email: toEmail,
    payload: event,
    occurred_at: createdAt || new Date().toISOString()
  });

  if (!emailId) return;

  // Find message
  const { data: message } = await supabase
    .from('messages')
    .select('id')
    .eq('provider_message_id', emailId)
    .single();

  switch (eventType) {
    case 'email.delivered':
      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'delivered',
            delivered_at: createdAt || new Date().toISOString()
          })
          .eq('id', message.id);
      }
      break;

    case 'email.bounced':
      if (message) {
        await supabase
          .from('messages')
          .update({
            status: 'bounced',
            bounced_at: createdAt || new Date().toISOString()
          })
          .eq('id', message.id);
      }

      if (toEmail) {
        await supabase
          .from('contacts')
          .update({ status: 'bounced' })
          .eq('email', toEmail.toLowerCase());
      }
      break;

    case 'email.complained':
      if (message) {
        await supabase
          .from('messages')
          .update({ status: 'complained' })
          .eq('id', message.id);
      }

      if (toEmail) {
        await supabase
          .from('contacts')
          .update({ status: 'complained' })
          .eq('email', toEmail.toLowerCase());

        await supabase
          .from('unsubscribes')
          .upsert({ email: toEmail.toLowerCase(), reason: 'Spam complaint' }, { onConflict: 'email' });
      }
      break;

    case 'email.opened':
      if (message) {
        const openAt = createdAt || new Date().toISOString();

        const { data: resendMsgOpen } = await supabase
          .from('messages')
          .select('contact_id, campaign_id, open_count')
          .eq('id', message.id)
          .single();

        await supabase
          .from('messages')
          .update({
            opened_at: openAt,
            open_count: (resendMsgOpen?.open_count || 0) + 1,
          })
          .eq('id', message.id);

        if (resendMsgOpen) {
          try {
            await processOpenEvent({
              contact_id: resendMsgOpen.contact_id,
              event_type: 'open',
              message_id: message.id,
              campaign_id: resendMsgOpen.campaign_id,
              occurred_at: openAt,
            });
          } catch {
            // Engagement tracking failure should not block webhook processing
          }
        }
      }
      break;

    case 'email.clicked':
      if (message) {
        const clickAt = createdAt || new Date().toISOString();

        const { data: resendMsgClick } = await supabase
          .from('messages')
          .select('contact_id, campaign_id, clicked_at, click_count')
          .eq('id', message.id)
          .single();

        await supabase
          .from('messages')
          .update({
            clicked_at: resendMsgClick?.clicked_at || clickAt,
            click_count: (resendMsgClick?.click_count || 0) + 1,
          })
          .eq('id', message.id);

        if (resendMsgClick) {
          try {
            await processClickEvent({
              contact_id: resendMsgClick.contact_id,
              event_type: 'click',
              message_id: message.id,
              campaign_id: resendMsgClick.campaign_id,
              occurred_at: clickAt,
            });
          } catch {
            // Engagement tracking failure should not block webhook processing
          }
        }
      }
      break;
  }
}
