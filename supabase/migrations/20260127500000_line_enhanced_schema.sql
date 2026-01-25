-- Phase 6: LINE Integration Enhancement Schema
-- Segment-based broadcasts and contact linking

-- LINE Segments (for targeted delivery)
CREATE TABLE IF NOT EXISTS line_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{"operator": "AND", "conditions": []}',
  -- rules structure:
  -- {
  --   "operator": "AND" | "OR",
  --   "conditions": [
  --     { "field": "tag", "operator": "contains", "value": "vip" },
  --     { "field": "purchase_count", "operator": "gte", "value": 1 },
  --     { "field": "last_interaction_at", "operator": "within_days", "value": 30 }
  --   ]
  -- }
  audience_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LINE Broadcasts
CREATE TYPE line_broadcast_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS line_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES line_segments(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  messages JSONB NOT NULL, -- Array of LINE message objects
  -- messages structure:
  -- [
  --   { "type": "text", "text": "Hello!" },
  --   { "type": "image", "originalContentUrl": "...", "previewImageUrl": "..." },
  --   { "type": "flex", "altText": "...", "contents": {...} }
  -- ]
  status line_broadcast_status NOT NULL DEFAULT 'draft',
  target_type VARCHAR(50) DEFAULT 'segment', -- 'segment', 'all', 'specific'
  target_user_ids TEXT[], -- For 'specific' target type
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LINE Broadcast Recipients (for tracking)
CREATE TYPE line_message_status AS ENUM ('pending', 'sent', 'delivered', 'failed');

CREATE TABLE IF NOT EXISTS line_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES line_broadcasts(id) ON DELETE CASCADE,
  line_user_id VARCHAR(100) NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status line_message_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LINE Rich Menus
CREATE TABLE IF NOT EXISTS line_rich_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_account_id UUID NOT NULL REFERENCES line_accounts(id) ON DELETE CASCADE,
  line_rich_menu_id VARCHAR(100), -- LINE's rich menu ID
  name VARCHAR(255) NOT NULL,
  chat_bar_text VARCHAR(100) NOT NULL DEFAULT 'Menu',
  size JSONB NOT NULL DEFAULT '{"width": 2500, "height": 1686}',
  areas JSONB NOT NULL DEFAULT '[]', -- Array of tap areas with actions
  image_url TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enhance contact_line_links table (if not already done in l_step_schema)
DO $$
BEGIN
  -- Add tags column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_line_links' AND column_name = 'tags'
  ) THEN
    ALTER TABLE contact_line_links ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;

  -- Add rich_menu_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_line_links' AND column_name = 'rich_menu_id'
  ) THEN
    ALTER TABLE contact_line_links ADD COLUMN rich_menu_id UUID REFERENCES line_rich_menus(id) ON DELETE SET NULL;
  END IF;

  -- Add last_interaction_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_line_links' AND column_name = 'last_interaction_at'
  ) THEN
    ALTER TABLE contact_line_links ADD COLUMN last_interaction_at TIMESTAMPTZ;
  END IF;

  -- Add interaction_count column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_line_links' AND column_name = 'interaction_count'
  ) THEN
    ALTER TABLE contact_line_links ADD COLUMN interaction_count INTEGER DEFAULT 0;
  END IF;

  -- Add purchase_count column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_line_links' AND column_name = 'purchase_count'
  ) THEN
    ALTER TABLE contact_line_links ADD COLUMN purchase_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- LINE Message Templates
CREATE TABLE IF NOT EXISTS line_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'welcome', 'promotion', 'reminder', etc.
  messages JSONB NOT NULL,
  variables TEXT[] DEFAULT '{}', -- ['name', 'product_name', etc.]
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LINE Linking Tokens (for email-to-LINE linking)
CREATE TABLE IF NOT EXISTS line_linking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  linked_line_user_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_line_segments_user_id ON line_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_line_segments_line_account_id ON line_segments(line_account_id);
CREATE INDEX IF NOT EXISTS idx_line_broadcasts_user_id ON line_broadcasts(user_id);
CREATE INDEX IF NOT EXISTS idx_line_broadcasts_status ON line_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_line_broadcasts_scheduled_at ON line_broadcasts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_line_broadcast_recipients_broadcast_id ON line_broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_line_broadcast_recipients_line_user_id ON line_broadcast_recipients(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_rich_menus_user_id ON line_rich_menus(user_id);
CREATE INDEX IF NOT EXISTS idx_line_rich_menus_line_account_id ON line_rich_menus(line_account_id);
CREATE INDEX IF NOT EXISTS idx_line_message_templates_user_id ON line_message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_line_linking_tokens_token ON line_linking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_line_linking_tokens_contact_id ON line_linking_tokens(contact_id);

-- RLS Policies
ALTER TABLE line_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_rich_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_linking_tokens ENABLE ROW LEVEL SECURITY;

-- Segments policies
CREATE POLICY "Users can view own segments" ON line_segments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own segments" ON line_segments
  FOR ALL USING (auth.uid() = user_id);

-- Broadcasts policies
CREATE POLICY "Users can view own broadcasts" ON line_broadcasts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own broadcasts" ON line_broadcasts
  FOR ALL USING (auth.uid() = user_id);

-- Broadcast recipients policies
CREATE POLICY "Users can view own broadcast recipients" ON line_broadcast_recipients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM line_broadcasts WHERE line_broadcasts.id = line_broadcast_recipients.broadcast_id AND line_broadcasts.user_id = auth.uid())
  );
CREATE POLICY "Service role can manage broadcast recipients" ON line_broadcast_recipients
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Rich menus policies
CREATE POLICY "Users can view own rich menus" ON line_rich_menus
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own rich menus" ON line_rich_menus
  FOR ALL USING (auth.uid() = user_id);

-- Message templates policies
CREATE POLICY "Users can view own message templates" ON line_message_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own message templates" ON line_message_templates
  FOR ALL USING (auth.uid() = user_id);

-- Linking tokens policies
CREATE POLICY "Users can view own linking tokens" ON line_linking_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own linking tokens" ON line_linking_tokens
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage linking tokens" ON line_linking_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to generate linking token
CREATE OR REPLACE FUNCTION generate_line_linking_token(p_user_id UUID, p_contact_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  i INTEGER;
BEGIN
  -- Generate random 32 character token
  v_token := '';
  FOR i IN 1..32 LOOP
    v_token := v_token || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
  END LOOP;

  -- Insert token
  INSERT INTO line_linking_tokens (user_id, contact_id, token, expires_at)
  VALUES (p_user_id, p_contact_id, v_token, NOW() + INTERVAL '24 hours');

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to link LINE user via token
CREATE OR REPLACE FUNCTION link_line_user_via_token(p_token TEXT, p_line_user_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_token_record line_linking_tokens%ROWTYPE;
  v_contact contacts%ROWTYPE;
BEGIN
  -- Find valid token
  SELECT * INTO v_token_record
  FROM line_linking_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  -- Get contact
  SELECT * INTO v_contact
  FROM contacts
  WHERE id = v_token_record.contact_id;

  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  -- Create or update LINE link
  INSERT INTO contact_line_links (contact_id, line_user_id, is_friend)
  VALUES (v_token_record.contact_id, p_line_user_id, TRUE)
  ON CONFLICT (contact_id) DO UPDATE
  SET line_user_id = p_line_user_id, is_friend = TRUE, updated_at = NOW();

  -- Mark token as used
  UPDATE line_linking_tokens
  SET used_at = NOW(), linked_line_user_id = p_line_user_id
  WHERE id = v_token_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', v_token_record.contact_id,
    'email', v_contact.email,
    'name', v_contact.first_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to evaluate segment rules
CREATE OR REPLACE FUNCTION evaluate_line_segment(p_segment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_segment line_segments%ROWTYPE;
  v_count INTEGER;
  v_query TEXT;
BEGIN
  SELECT * INTO v_segment FROM line_segments WHERE id = p_segment_id;

  IF v_segment IS NULL THEN
    RETURN 0;
  END IF;

  -- Build dynamic query based on rules
  -- This is a simplified version; actual implementation would parse rules JSON
  SELECT COUNT(DISTINCT cll.line_user_id) INTO v_count
  FROM contact_line_links cll
  JOIN contacts c ON cll.contact_id = c.id
  WHERE c.user_id = v_segment.user_id
    AND cll.is_friend = TRUE;

  -- Update segment audience count
  UPDATE line_segments
  SET audience_count = v_count, last_calculated_at = NOW(), updated_at = NOW()
  WHERE id = p_segment_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update LINE interaction stats
CREATE OR REPLACE FUNCTION update_line_interaction_stats(p_line_user_id VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_line_links
  SET
    last_interaction_at = NOW(),
    interaction_count = interaction_count + 1,
    updated_at = NOW()
  WHERE line_user_id = p_line_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
