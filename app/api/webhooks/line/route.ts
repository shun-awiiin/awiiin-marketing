import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LineClient } from '@/lib/line/line-client'
import { consumeToken } from '@/lib/line/line-linker'

interface LineWebhookEvent {
  type: 'follow' | 'unfollow' | 'message' | 'postback'
  source: {
    type: 'user' | 'group' | 'room'
    userId?: string
    groupId?: string
    roomId?: string
  }
  timestamp: number
  replyToken?: string
  message?: {
    type: string
    id: string
    text?: string
  }
  postback?: {
    data: string
  }
}

interface LineWebhookBody {
  destination: string
  events: LineWebhookEvent[]
}

// POST /api/webhooks/line - LINE Webhook endpoint
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Get raw body for signature verification
  const body = await request.text()
  const signature = request.headers.get('x-line-signature')

  let parsed: LineWebhookBody
  try {
    parsed = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Find account by destination (bot user ID)
  const { data: accounts } = await supabase
    .from('line_accounts')
    .select('*')

  // Find matching account
  let account = null
  for (const acc of accounts || []) {
    const client = new LineClient(acc.access_token, acc.channel_secret)
    if (signature && client.verifySignature(body, signature)) {
      account = acc
      break
    }
  }

  if (!account) {
    // Return 200 even if no matching account (LINE requirement)
    return NextResponse.json({ success: true })
  }

  // Process events
  for (const event of parsed.events) {
    try {
      await handleLineEvent(supabase, account, event)
    } catch (err) {
      // Log error but continue processing other events
    }
  }

  return NextResponse.json({ success: true })
}

async function handleLineEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: {
    id: string
    user_id: string
    access_token: string
    channel_secret: string
  },
  event: LineWebhookEvent
) {
  const lineUserId = event.source.userId

  if (!lineUserId) return

  switch (event.type) {
    case 'follow':
      await handleFollowEvent(supabase, account, lineUserId)
      break
    case 'unfollow':
      await handleUnfollowEvent(supabase, account, lineUserId)
      break
    case 'message':
      await handleMessageEvent(supabase, account, lineUserId, event)
      break
    case 'postback':
      await handlePostbackEvent(supabase, account, lineUserId, event)
      break
  }
}

async function handleFollowEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: { id: string; user_id: string; access_token: string; channel_secret: string },
  lineUserId: string
) {
  // Get user profile
  const client = new LineClient(account.access_token, account.channel_secret)
  let profile = { displayName: 'LINE User', pictureUrl: undefined as string | undefined }

  try {
    profile = await client.getProfile(lineUserId)
  } catch {
    // Profile fetch failed, use default
  }

  // Check if already linked
  const { data: existingLink } = await supabase
    .from('contact_line_links')
    .select('*')
    .eq('line_user_id', lineUserId)
    .eq('line_account_id', account.id)
    .single()

  if (existingLink) {
    // Update status to active
    await supabase
      .from('contact_line_links')
      .update({
        status: 'active',
        display_name: profile.displayName,
        picture_url: profile.pictureUrl
      })
      .eq('id', existingLink.id)
    return
  }

  // Create new contact
  const { data: newContact } = await supabase
    .from('contacts')
    .insert({
      user_id: account.user_id,
      first_name: profile.displayName,
      email: `line_${lineUserId}@line.placeholder`,
      status: 'active'
    })
    .select()
    .single()

  if (newContact) {
    // Create link
    await supabase
      .from('contact_line_links')
      .insert({
        contact_id: newContact.id,
        line_user_id: lineUserId,
        line_account_id: account.id,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        status: 'active'
      })
  }
}

async function handleUnfollowEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: { id: string },
  lineUserId: string
) {
  // Mark as blocked
  await supabase
    .from('contact_line_links')
    .update({ status: 'blocked' })
    .eq('line_user_id', lineUserId)
    .eq('line_account_id', account.id)
}

async function handleMessageEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: { id: string },
  lineUserId: string,
  event: LineWebhookEvent
) {
  // Get contact
  const { data: link } = await supabase
    .from('contact_line_links')
    .select('contact_id')
    .eq('line_user_id', lineUserId)
    .eq('line_account_id', account.id)
    .single()

  // Log received message
  await supabase.from('line_messages').insert({
    line_account_id: account.id,
    contact_id: link?.contact_id,
    line_user_id: lineUserId,
    message_type: 'received',
    content: event.message || {},
    status: 'delivered'
  })
}

async function handlePostbackEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: { id: string; user_id: string },
  lineUserId: string,
  event: LineWebhookEvent
) {
  if (!event.postback?.data) return

  const params = new URLSearchParams(event.postback.data)
  const action = params.get('action')

  switch (action) {
    case 'link_token': {
      // Token-based linking flow
      const token = params.get('token')
      if (token) {
        // Get profile for display name
        const client = new LineClient(account.access_token, account.channel_secret)
        let profile = { displayName: undefined as string | undefined, pictureUrl: undefined as string | undefined }
        try {
          const profileData = await client.getProfile(lineUserId)
          profile = { displayName: profileData.displayName, pictureUrl: profileData.pictureUrl }
        } catch {
          // Profile fetch failed, continue without
        }

        await consumeToken(supabase, token, lineUserId, profile.displayName, profile.pictureUrl)
      }
      break
    }
    case 'link_email': {
      // Email linking flow
      const email = params.get('email')
      if (email) {
        // Find contact by email and link
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', account.user_id)
          .eq('email', email)
          .single()

        if (contact) {
          await supabase
            .from('contact_line_links')
            .upsert({
              contact_id: contact.id,
              line_user_id: lineUserId,
              line_account_id: account.id,
              status: 'active'
            }, { onConflict: 'line_user_id,line_account_id' })
        }
      }
      break
    }
    case 'scenario_trigger': {
      // Trigger scenario enrollment
      const scenarioId = params.get('scenario_id')
      if (scenarioId) {
        const { data: link } = await supabase
          .from('contact_line_links')
          .select('contact_id')
          .eq('line_user_id', lineUserId)
          .eq('line_account_id', account.id)
          .single()

        if (link?.contact_id) {
          // Enroll in scenario
          const { data: firstStep } = await supabase
            .from('scenario_steps')
            .select('id')
            .eq('scenario_id', scenarioId)
            .order('step_order', { ascending: true })
            .limit(1)
            .single()

          if (firstStep) {
            await supabase
              .from('scenario_enrollments')
              .upsert({
                scenario_id: scenarioId,
                contact_id: link.contact_id,
                current_step_id: firstStep.id,
                status: 'active',
                next_action_at: new Date().toISOString()
              }, { onConflict: 'scenario_id,contact_id' })
          }
        }
      }
      break
    }
  }
}
