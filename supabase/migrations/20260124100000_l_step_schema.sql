-- L-Step Feature Schema
-- Scenario-based email/LINE delivery, segments, custom fields

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE scenario_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE step_type AS ENUM ('email', 'wait', 'condition', 'line', 'action');
CREATE TYPE trigger_type AS ENUM ('signup', 'tag_added', 'tag_removed', 'form_submit', 'manual');
CREATE TYPE condition_type AS ENUM ('opened', 'clicked', 'not_opened', 'not_clicked', 'has_tag', 'custom_field');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'paused', 'exited');
CREATE TYPE field_type AS ENUM ('text', 'number', 'date', 'boolean', 'select');
CREATE TYPE line_message_status AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- ============================================
-- TABLES
-- ============================================

-- Scenarios (step mail sequences)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status scenario_status NOT NULL DEFAULT 'draft',
  trigger_type trigger_type NOT NULL DEFAULT 'manual',
  trigger_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX idx_scenarios_status ON scenarios(status);

-- Scenario Steps
CREATE TABLE scenario_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type step_type NOT NULL,
  name VARCHAR(255),
  config JSONB NOT NULL DEFAULT '{}',
  condition_type condition_type,
  condition_config JSONB,
  next_step_id UUID REFERENCES scenario_steps(id) ON DELETE SET NULL,
  condition_yes_step_id UUID REFERENCES scenario_steps(id) ON DELETE SET NULL,
  condition_no_step_id UUID REFERENCES scenario_steps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scenario_id, step_order)
);

CREATE INDEX idx_scenario_steps_scenario_id ON scenario_steps(scenario_id);

-- Scenario Enrollments (contacts enrolled in scenarios)
CREATE TABLE scenario_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES scenario_steps(id) ON DELETE SET NULL,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_action_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(scenario_id, contact_id)
);

CREATE INDEX idx_enrollments_next_action ON scenario_enrollments(next_action_at)
  WHERE status = 'active';
CREATE INDEX idx_enrollments_contact ON scenario_enrollments(contact_id);
CREATE INDEX idx_enrollments_scenario ON scenario_enrollments(scenario_id);

-- Segments
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{"operator": "AND", "conditions": []}',
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_user_id ON segments(user_id);

-- Custom Fields
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  options JSONB,
  required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, field_key)
);

CREATE INDEX idx_custom_fields_user_id ON custom_fields(user_id);

-- Contact Custom Values
CREATE TABLE contact_custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, field_id)
);

CREATE INDEX idx_custom_values_contact ON contact_custom_values(contact_id);
CREATE INDEX idx_custom_values_field ON contact_custom_values(field_id);

-- LINE Accounts
CREATE TABLE line_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id VARCHAR(255) NOT NULL,
  channel_secret VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  bot_basic_id VARCHAR(100),
  display_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

CREATE INDEX idx_line_accounts_user_id ON line_accounts(user_id);

-- Contact LINE Links
CREATE TABLE contact_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  line_user_id VARCHAR(255) NOT NULL,
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  picture_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, line_account_id),
  UNIQUE(line_user_id, line_account_id)
);

CREATE INDEX idx_line_links_line_user ON contact_line_links(line_user_id);
CREATE INDEX idx_line_links_contact ON contact_line_links(contact_id);

-- LINE Messages
CREATE TABLE line_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  line_user_id VARCHAR(255) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  status line_message_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_messages_contact ON line_messages(contact_id);
CREATE INDEX idx_line_messages_status ON line_messages(status);
CREATE INDEX idx_line_messages_line_user ON line_messages(line_user_id);

-- Link Tokens (for LINE-Contact linking)
CREATE TABLE link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_link_tokens_token ON link_tokens(token);

-- Email Events (for condition tracking)
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  email_id VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_events_contact ON email_events(contact_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_email_id ON email_events(email_id);

-- Scenario Logs
CREATE TABLE scenario_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES scenario_enrollments(id) ON DELETE SET NULL,
  step_id UUID REFERENCES scenario_steps(id) ON DELETE SET NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scenario_logs_scenario ON scenario_logs(scenario_id);
CREATE INDEX idx_scenario_logs_level ON scenario_logs(level);
CREATE INDEX idx_scenario_logs_created ON scenario_logs(created_at);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_scenarios_updated_at
  BEFORE UPDATE ON scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenario_steps_updated_at
  BEFORE UPDATE ON scenario_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_custom_values_updated_at
  BEFORE UPDATE ON contact_custom_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_accounts_updated_at
  BEFORE UPDATE ON line_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_line_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_logs ENABLE ROW LEVEL SECURITY;

-- Scenarios
CREATE POLICY "Users can manage own scenarios" ON scenarios
  FOR ALL USING (auth.uid() = user_id);

-- Scenario Steps (through scenarios)
CREATE POLICY "Users can manage own scenario steps" ON scenario_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM scenarios WHERE scenarios.id = scenario_id AND scenarios.user_id = auth.uid())
  );

-- Scenario Enrollments (through scenarios)
CREATE POLICY "Users can manage own enrollments" ON scenario_enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM scenarios WHERE scenarios.id = scenario_id AND scenarios.user_id = auth.uid())
  );

-- Segments
CREATE POLICY "Users can manage own segments" ON segments
  FOR ALL USING (auth.uid() = user_id);

-- Custom Fields
CREATE POLICY "Users can manage own custom_fields" ON custom_fields
  FOR ALL USING (auth.uid() = user_id);

-- Contact Custom Values (through contacts)
CREATE POLICY "Users can manage contact custom values" ON contact_custom_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
  );

-- LINE Accounts
CREATE POLICY "Users can manage own line_accounts" ON line_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Contact LINE Links (through contacts)
CREATE POLICY "Users can manage contact line links" ON contact_line_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
  );

-- LINE Messages (through line_accounts)
CREATE POLICY "Users can view own line messages" ON line_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM line_accounts WHERE line_accounts.id = line_account_id AND line_accounts.user_id = auth.uid())
  );

-- Link Tokens (through contacts)
CREATE POLICY "Users can manage link tokens" ON link_tokens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
  );

-- Email Events (through contacts)
CREATE POLICY "Users can view email events" ON email_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
  );

-- Scenario Logs (through scenarios)
CREATE POLICY "Users can view scenario logs" ON scenario_logs
  FOR SELECT USING (
    scenario_id IS NULL OR
    EXISTS (SELECT 1 FROM scenarios WHERE scenarios.id = scenario_id AND scenarios.user_id = auth.uid())
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get scenario stats
CREATE OR REPLACE FUNCTION get_scenario_stats(p_scenario_id UUID)
RETURNS TABLE (
  total_enrolled BIGINT,
  active_count BIGINT,
  completed_count BIGINT,
  paused_count BIGINT,
  exited_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_enrolled,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_count,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_count,
    COUNT(*) FILTER (WHERE status = 'paused')::BIGINT as paused_count,
    COUNT(*) FILTER (WHERE status = 'exited')::BIGINT as exited_count
  FROM scenario_enrollments
  WHERE scenario_id = p_scenario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advisory lock functions for scenario processing
CREATE OR REPLACE FUNCTION acquire_advisory_lock(lock_key INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_advisory_lock(lock_key INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_key);
END;
$$ LANGUAGE plpgsql;
