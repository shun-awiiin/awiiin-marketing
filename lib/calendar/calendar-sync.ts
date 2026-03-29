/**
 * Calendar Sync Logic
 * Fetches events from Google Calendar, matches attendee emails to contacts,
 * and creates contact_activities entries for matched meetings.
 */

import { GoogleCalendarClient } from './google-client'
import type {
  CalendarConnection,
  GoogleCalendarEvent,
  CalendarEvent,
} from '@/lib/types/calendar'
import type { SupabaseClient } from '@supabase/supabase-js'

interface SyncResult {
  synced: number
  matched: number
  errors: number
  syncToken: string | null
}

/**
 * Extract Meet link from event data.
 */
function extractMeetLink(event: GoogleCalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink

  const entryPoints = event.conferenceData?.entryPoints
  if (entryPoints) {
    const videoEntry = entryPoints.find(
      (ep) => ep.entryPointType === 'video'
    )
    if (videoEntry) return videoEntry.uri
  }

  return null
}

/**
 * Convert Google Calendar event to our DB format.
 */
function toCalendarEvent(
  event: GoogleCalendarEvent,
  userId: string
): Omit<CalendarEvent, 'id' | 'contact_ids' | 'created_at' | 'updated_at'> {
  const startAt =
    event.start?.dateTime || event.start?.date || new Date().toISOString()
  const endAt =
    event.end?.dateTime || event.end?.date || startAt
  const isAllDay = !event.start?.dateTime

  const attendeeEmails = (event.attendees || [])
    .filter((a) => !a.self)
    .map((a) => a.email)

  const organizerEmail = event.organizer?.email || null

  let status: 'confirmed' | 'tentative' | 'cancelled' = 'confirmed'
  if (event.status === 'tentative') status = 'tentative'
  if (event.status === 'cancelled') status = 'cancelled'

  return {
    user_id: userId,
    google_event_id: event.id,
    summary: event.summary || null,
    description: event.description || null,
    start_at: startAt,
    end_at: endAt,
    location: event.location || null,
    meet_link: extractMeetLink(event),
    attendee_emails: attendeeEmails,
    status,
    is_all_day: isAllDay,
    organizer_email: organizerEmail,
    synced_at: new Date().toISOString(),
  }
}

/**
 * Match attendee emails to existing contacts and return matched contact IDs.
 */
async function matchAttendeesToContacts(
  supabase: SupabaseClient,
  userId: string,
  attendeeEmails: string[]
): Promise<string[]> {
  if (attendeeEmails.length === 0) return []

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('user_id', userId)
    .in('email', attendeeEmails)

  return (contacts || []).map((c) => c.id)
}

/**
 * Create timeline activities for matched meetings.
 */
async function createMeetingActivities(
  supabase: SupabaseClient,
  userId: string,
  event: CalendarEvent,
  contactIds: string[]
): Promise<void> {
  if (contactIds.length === 0) return

  const now = new Date()
  const eventStart = new Date(event.start_at)
  const activityType = eventStart > now ? 'meeting_scheduled' : 'meeting_completed'

  const activities = contactIds.map((contactId) => ({
    contact_id: contactId,
    user_id: userId,
    activity_type: activityType,
    title:
      activityType === 'meeting_scheduled'
        ? `ミーティング予定: ${event.summary || '(タイトルなし)'}`
        : `ミーティング完了: ${event.summary || '(タイトルなし)'}`,
    description: event.location || event.meet_link || null,
    metadata: {
      calendar_event_id: event.id,
      google_event_id: event.google_event_id,
      start_at: event.start_at,
      end_at: event.end_at,
      meet_link: event.meet_link,
    },
    reference_type: 'calendar_event',
    reference_id: event.id,
    occurred_at: event.start_at,
  }))

  // Upsert to avoid duplicate activities for same event+contact
  for (const activity of activities) {
    const { data: existing } = await supabase
      .from('contact_activities')
      .select('id')
      .eq('contact_id', activity.contact_id)
      .eq('reference_type', 'calendar_event')
      .eq('reference_id', activity.reference_id)
      .maybeSingle()

    if (!existing) {
      await supabase.from('contact_activities').insert(activity)
    }
  }
}

/**
 * Run a full or incremental sync for a single calendar connection.
 */
export async function syncCalendarEvents(
  supabase: SupabaseClient,
  connection: CalendarConnection,
  options: { force?: boolean } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    matched: 0,
    errors: 0,
    syncToken: null,
  }

  const client = new GoogleCalendarClient({
    connection,
    onTokenRefreshed: async (newAccessToken, newExpiresAt) => {
      await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: newAccessToken,
          token_expires_at: newExpiresAt,
        })
        .eq('id', connection.id)
    },
  })

  const useSyncToken = !options.force && connection.sync_token
  let pageToken: string | undefined
  let allEvents: GoogleCalendarEvent[] = []

  try {
    // Fetch all pages of events
    do {
      const response = await client.listEvents({
        syncToken: useSyncToken ? connection.sync_token! : undefined,
        timeMin: useSyncToken
          ? undefined
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: useSyncToken
          ? undefined
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: 250,
        pageToken,
      })

      allEvents = allEvents.concat(response.items || [])
      pageToken = response.nextPageToken
      result.syncToken = response.nextSyncToken || null
    } while (pageToken)
  } catch (err: unknown) {
    // If sync token is invalid, do a full sync
    if (
      err instanceof Error &&
      err.message.includes('410')
    ) {
      return syncCalendarEvents(supabase, { ...connection, sync_token: null }, {
        force: true,
      })
    }
    throw err
  }

  // Process events
  for (const googleEvent of allEvents) {
    try {
      const eventData = toCalendarEvent(googleEvent, connection.user_id)

      // Handle cancelled events
      if (eventData.status === 'cancelled') {
        await supabase
          .from('calendar_events')
          .update({ status: 'cancelled', synced_at: new Date().toISOString() })
          .eq('user_id', connection.user_id)
          .eq('google_event_id', googleEvent.id)
        result.synced++
        continue
      }

      // Match attendees to contacts
      const contactIds = await matchAttendeesToContacts(
        supabase,
        connection.user_id,
        eventData.attendee_emails
      )

      // Upsert event
      const { data: upsertedEvent } = await supabase
        .from('calendar_events')
        .upsert(
          {
            ...eventData,
            contact_ids: contactIds,
          },
          { onConflict: 'user_id,google_event_id' }
        )
        .select('id, summary, start_at, end_at, meet_link, google_event_id')
        .single()

      if (upsertedEvent) {
        result.synced++

        if (contactIds.length > 0) {
          result.matched++
          await createMeetingActivities(
            supabase,
            connection.user_id,
            {
              ...eventData,
              id: upsertedEvent.id,
              contact_ids: contactIds,
              created_at: '',
              updated_at: '',
            } as CalendarEvent,
            contactIds
          )
        }
      }
    } catch {
      result.errors++
    }
  }

  // Update connection with new sync token and last sync time
  await supabase
    .from('calendar_connections')
    .update({
      sync_token: result.syncToken || connection.sync_token,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return result
}
