/**
 * Unified Social Media Webhook Handler
 * Handles webhooks from X, Instagram, YouTube, and WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyHmacSignature } from '@/lib/social/encryption'
import type { SocialProvider } from '@/lib/social/types'

// Webhook verification for Meta (Instagram, WhatsApp)
const VERIFY_TOKEN = process.env.SOCIAL_WEBHOOK_VERIFY_TOKEN || ''

/**
 * GET - Webhook verification (Meta platforms)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Meta webhook verification
  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST - Handle incoming webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256') ||
                      request.headers.get('x-twitter-webhooks-signature')

    // Determine provider from request
    const provider = detectProvider(request, body)

    if (!provider) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    // Verify signature
    if (!verifyWebhookSignature(provider, body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)

    // Process webhook based on provider
    switch (provider) {
      case 'x':
        await processXWebhook(payload)
        break
      case 'instagram':
        await processInstagramWebhook(payload)
        break
      case 'youtube':
        await processYouTubeWebhook(payload)
        break
      case 'whatsapp':
        await processWhatsAppWebhook(payload)
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Detect which provider sent the webhook
 */
function detectProvider(request: NextRequest, body: string): SocialProvider | null {
  // X (Twitter) webhooks
  if (request.headers.get('x-twitter-webhooks-signature')) {
    return 'x'
  }

  // Meta webhooks (Instagram, WhatsApp)
  if (request.headers.get('x-hub-signature-256')) {
    try {
      const payload = JSON.parse(body)

      // Check object type
      if (payload.object === 'instagram') {
        return 'instagram'
      }
      if (payload.object === 'whatsapp_business_account') {
        return 'whatsapp'
      }
    } catch {
      return null
    }
  }

  // YouTube PubSubHubbub
  if (request.headers.get('x-hub-signature')) {
    return 'youtube'
  }

  return null
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(
  provider: SocialProvider,
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false

  const secrets: Record<SocialProvider, string | undefined> = {
    x: process.env.X_WEBHOOK_SECRET,
    instagram: process.env.FACEBOOK_APP_SECRET,
    youtube: process.env.YOUTUBE_WEBHOOK_SECRET,
    whatsapp: process.env.FACEBOOK_APP_SECRET,
  }

  const secret = secrets[provider]
  if (!secret) return false

  // Extract hash from signature
  const hash = signature.replace(/^sha256=/, '')

  return verifyHmacSignature(body, hash, secret)
}

/**
 * Process X (Twitter) webhook
 */
async function processXWebhook(payload: Record<string, unknown>): Promise<void> {
  const supabase = await createServiceClient()

  // Handle different X webhook types
  if (payload.tweet_create_events) {
    // New tweet mentions or replies
    const events = payload.tweet_create_events as Array<Record<string, unknown>>
    for (const event of events) {
      await logWebhookEvent(supabase, 'x', 'tweet_create', event)
    }
  }

  if (payload.favorite_events) {
    // Tweet liked
    const events = payload.favorite_events as Array<Record<string, unknown>>
    for (const event of events) {
      await logWebhookEvent(supabase, 'x', 'favorite', event)
    }
  }

  if (payload.tweet_delete_events) {
    // Tweet deleted
    const events = payload.tweet_delete_events as Array<Record<string, unknown>>
    for (const event of events) {
      await logWebhookEvent(supabase, 'x', 'tweet_delete', event)
    }
  }
}

/**
 * Process Instagram webhook
 */
async function processInstagramWebhook(payload: Record<string, unknown>): Promise<void> {
  const supabase = await createServiceClient()
  const entries = payload.entry as Array<Record<string, unknown>> || []

  for (const entry of entries) {
    const changes = entry.changes as Array<Record<string, unknown>> || []

    for (const change of changes) {
      const field = change.field as string

      if (field === 'comments') {
        // New comment on a post
        await logWebhookEvent(supabase, 'instagram', 'comment', change.value as Record<string, unknown>)
      }

      if (field === 'mentions') {
        // Mentioned in a post
        await logWebhookEvent(supabase, 'instagram', 'mention', change.value as Record<string, unknown>)
      }

      if (field === 'story_insights') {
        // Story insights
        await logWebhookEvent(supabase, 'instagram', 'story_insights', change.value as Record<string, unknown>)
      }
    }
  }
}

/**
 * Process YouTube webhook (PubSubHubbub)
 */
async function processYouTubeWebhook(payload: Record<string, unknown>): Promise<void> {
  const supabase = await createServiceClient()

  // YouTube sends Atom feed updates
  await logWebhookEvent(supabase, 'youtube', 'feed_update', payload)
}

/**
 * Process WhatsApp webhook
 */
async function processWhatsAppWebhook(payload: Record<string, unknown>): Promise<void> {
  const supabase = await createServiceClient()
  const entries = payload.entry as Array<Record<string, unknown>> || []

  for (const entry of entries) {
    const changes = entry.changes as Array<Record<string, unknown>> || []

    for (const change of changes) {
      const value = change.value as Record<string, unknown>

      // Message status updates
      const statuses = value.statuses as Array<Record<string, unknown>> || []
      for (const status of statuses) {
        await logWebhookEvent(supabase, 'whatsapp', 'message_status', status)
      }

      // Incoming messages
      const messages = value.messages as Array<Record<string, unknown>> || []
      for (const message of messages) {
        await logWebhookEvent(supabase, 'whatsapp', 'message_received', message)
      }
    }
  }
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  provider: SocialProvider,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await supabase.from('social_events').insert({
    provider,
    event_type: `webhook_${eventType}`,
    payload,
    occurred_at: new Date().toISOString(),
  })
}
