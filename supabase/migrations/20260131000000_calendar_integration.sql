-- Calendar Integration Schema
-- Google Calendar sync, meeting tracking, and reminders
-- Date: 2026-01-31

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE calendar_event_status AS ENUM ('confirmed', 'tentative', 'cancelled');
CREATE TYPE reminder_type AS ENUM ('email', 'notification');

-- ============================================
-- CALENDAR CONNECTIONS
-- ============================================

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_token TEXT,
  last_synced_at TIMESTAMPTZ,
  google_email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_connections_user_unique UNIQUE (user_id)
);

CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_sync_enabled ON calendar_connections(sync_enabled) WHERE sync_enabled = TRUE;

-- ============================================
-- CALENDAR EVENTS
-- ============================================

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id VARCHAR(1024) NOT NULL,
  summary VARCHAR(1024),
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location VARCHAR(2048),
  meet_link VARCHAR(2048),
  attendee_emails JSONB NOT NULL DEFAULT '[]',
  contact_ids JSONB NOT NULL DEFAULT '[]',
  status calendar_event_status NOT NULL DEFAULT 'confirmed',
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  organizer_email VARCHAR(255),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_events_unique UNIQUE (user_id, google_event_id)
);

CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_google_event_id ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_start_at ON calendar_events(start_at);
CREATE INDEX idx_calendar_events_end_at ON calendar_events(end_at);
CREATE INDEX idx_calendar_events_attendee_emails ON calendar_events USING GIN (attendee_emails);
CREATE INDEX idx_calendar_events_contact_ids ON calendar_events USING GIN (contact_ids);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);

-- ============================================
-- MEETING REMINDERS
-- ============================================

CREATE TABLE meeting_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  remind_before_minutes INTEGER NOT NULL DEFAULT 15,
  reminder_type reminder_type NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meeting_reminders_user_id ON meeting_reminders(user_id);
CREATE INDEX idx_meeting_reminders_event_id ON meeting_reminders(event_id);
CREATE INDEX idx_meeting_reminders_pending ON meeting_reminders(sent_at) WHERE sent_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_reminders ENABLE ROW LEVEL SECURITY;

-- Calendar connections: users can only manage their own
CREATE POLICY "calendar_connections_select_own"
  ON calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_connections_insert_own"
  ON calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_connections_update_own"
  ON calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_connections_delete_own"
  ON calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Calendar events: users can only see their own
CREATE POLICY "calendar_events_select_own"
  ON calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_events_insert_own"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_events_update_own"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_events_delete_own"
  ON calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Meeting reminders: users can only manage their own
CREATE POLICY "meeting_reminders_select_own"
  ON meeting_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "meeting_reminders_insert_own"
  ON meeting_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meeting_reminders_update_own"
  ON meeting_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "meeting_reminders_delete_own"
  ON meeting_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass for cron jobs
CREATE POLICY "calendar_connections_service_role"
  ON calendar_connections FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "calendar_events_service_role"
  ON calendar_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "meeting_reminders_service_role"
  ON meeting_reminders FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER meeting_reminders_updated_at
  BEFORE UPDATE ON meeting_reminders
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();
