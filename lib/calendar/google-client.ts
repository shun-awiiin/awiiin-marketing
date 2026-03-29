/**
 * Google Calendar API client using raw fetch (no googleapis dependency).
 * Handles token refresh, event listing, and event creation.
 */

import { decrypt, encrypt } from './encryption'
import type {
  GoogleCalendarEvent,
  GoogleCalendarListResponse,
  CalendarConnection,
} from '@/lib/types/calendar'

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ============================================
// OAUTH HELPERS
// ============================================

export function getGoogleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI

  if (!clientId || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CALENDAR_REDIRECT_URI must be set')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Token exchange failed: ${res.status} - ${errorBody}`)
  }

  return res.json()
}

export async function refreshAccessToken(
  refreshTokenEncrypted: string
): Promise<{ access_token: string; expires_in: number }> {
  const refreshToken = decrypt(refreshTokenEncrypted)

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Token refresh failed: ${res.status} - ${errorBody}`)
  }

  return res.json()
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to get user info: ${res.status}`)
  }

  const data = await res.json()
  return data.email
}

// ============================================
// CALENDAR API CLIENT
// ============================================

interface CalendarClientOptions {
  connection: CalendarConnection
  onTokenRefreshed?: (
    newAccessToken: string,
    newExpiresAt: string
  ) => Promise<void>
}

export class GoogleCalendarClient {
  private connection: CalendarConnection
  private onTokenRefreshed?: CalendarClientOptions['onTokenRefreshed']

  constructor(options: CalendarClientOptions) {
    this.connection = options.connection
    this.onTokenRefreshed = options.onTokenRefreshed
  }

  private async getValidAccessToken(): Promise<string> {
    const expiresAt = new Date(this.connection.token_expires_at)
    const now = new Date()
    const bufferMs = 5 * 60 * 1000 // 5 min buffer

    if (expiresAt.getTime() - now.getTime() > bufferMs) {
      return decrypt(this.connection.access_token_encrypted)
    }

    // Token expired or about to expire - refresh
    const { access_token, expires_in } = await refreshAccessToken(
      this.connection.refresh_token_encrypted
    )

    const newExpiresAt = new Date(
      Date.now() + expires_in * 1000
    ).toISOString()

    const encryptedNewToken = encrypt(access_token)
    this.connection.access_token_encrypted = encryptedNewToken
    this.connection.token_expires_at = newExpiresAt

    if (this.onTokenRefreshed) {
      await this.onTokenRefreshed(encryptedNewToken, newExpiresAt)
    }

    return access_token
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getValidAccessToken()
    const url = new URL(`${GOOGLE_CALENDAR_BASE}${path}`)

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`Google Calendar API error: ${res.status} - ${errorBody}`)
    }

    return res.json()
  }

  /**
   * List events with incremental sync support.
   * Pass syncToken for incremental updates, or timeMin/timeMax for initial fetch.
   */
  async listEvents(options: {
    syncToken?: string
    timeMin?: string
    timeMax?: string
    maxResults?: number
    pageToken?: string
  }): Promise<GoogleCalendarListResponse> {
    const calendarId = encodeURIComponent(this.connection.calendar_id)
    const params: Record<string, string> = {
      singleEvents: 'true',
      orderBy: 'startTime',
    }

    if (options.syncToken) {
      params.syncToken = options.syncToken
    } else {
      if (options.timeMin) params.timeMin = options.timeMin
      if (options.timeMax) params.timeMax = options.timeMax
    }

    if (options.maxResults) {
      params.maxResults = String(options.maxResults)
    }

    if (options.pageToken) {
      params.pageToken = options.pageToken
    }

    return this.request<GoogleCalendarListResponse>(
      `/calendars/${calendarId}/events`,
      params
    )
  }

  /**
   * Get a single event by ID.
   */
  async getEvent(eventId: string): Promise<GoogleCalendarEvent> {
    const calendarId = encodeURIComponent(this.connection.calendar_id)
    const encodedEventId = encodeURIComponent(eventId)

    return this.request<GoogleCalendarEvent>(
      `/calendars/${calendarId}/events/${encodedEventId}`
    )
  }

  /**
   * Create a new event on the calendar.
   */
  async createEvent(event: {
    summary: string
    description?: string
    start: { dateTime: string; timeZone?: string }
    end: { dateTime: string; timeZone?: string }
    attendees?: { email: string }[]
    location?: string
  }): Promise<GoogleCalendarEvent> {
    const token = await this.getValidAccessToken()
    const calendarId = encodeURIComponent(this.connection.calendar_id)
    const url = `${GOOGLE_CALENDAR_BASE}/calendars/${calendarId}/events`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`Failed to create event: ${res.status} - ${errorBody}`)
    }

    return res.json()
  }
}
