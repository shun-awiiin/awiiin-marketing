-- Chat Widget, Standalone Forms, Contact Timeline Schema
-- Date: 2026-01-30

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE chat_conversation_status AS ENUM ('open', 'assigned', 'resolved', 'closed');
CREATE TYPE chat_message_role AS ENUM ('visitor', 'agent', 'system');
CREATE TYPE standalone_form_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE form_field_type AS ENUM ('text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'hidden');

-- ============================================
-- CHAT WIDGET TABLES
-- ============================================

-- Chat widget configurations per user
CREATE TABLE chat_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Default Widget',
  settings JSONB NOT NULL DEFAULT '{
    "position": "bottom-right",
    "primaryColor": "#6366f1",
    "greeting": "こんにちは！ご質問はございますか？",
    "placeholder": "メッセージを入力...",
    "offlineMessage": "現在オフラインです。メールでお問い合わせください。",
    "requireEmail": true
  }',
  allowed_domains TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_widgets_user_id ON chat_widgets(user_id);

-- Chat visitors (anonymous or identified)
CREATE TABLE chat_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES chat_widgets(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  browser_fingerprint VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_visitors_widget_id ON chat_visitors(widget_id);
CREATE INDEX idx_chat_visitors_contact_id ON chat_visitors(contact_id);
CREATE INDEX idx_chat_visitors_email ON chat_visitors(email);

-- Chat conversations
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES chat_widgets(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES chat_visitors(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status chat_conversation_status NOT NULL DEFAULT 'open',
  subject VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_conversations_widget_id ON chat_conversations(widget_id);
CREATE INDEX idx_chat_conversations_visitor_id ON chat_conversations(visitor_id);
CREATE INDEX idx_chat_conversations_contact_id ON chat_conversations(contact_id);
CREATE INDEX idx_chat_conversations_status ON chat_conversations(status);

-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role chat_message_role NOT NULL,
  sender_id UUID, -- user_id for agent, visitor_id for visitor
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================
-- STANDALONE FORM TABLES
-- ============================================

-- Standalone forms (independent of landing pages)
CREATE TABLE standalone_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  status standalone_form_status NOT NULL DEFAULT 'draft',
  fields JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{
    "submitLabel": "送信",
    "successMessage": "送信が完了しました。ありがとうございます。",
    "redirectUrl": null,
    "notifyEmail": null,
    "autoReplyEnabled": false,
    "autoReplySubject": "お問い合わせありがとうございます",
    "autoReplyBody": null,
    "autoReplyTemplateId": null,
    "scenarioId": null,
    "tagIds": []
  }',
  style JSONB DEFAULT '{
    "theme": "light",
    "primaryColor": "#6366f1",
    "borderRadius": "8px",
    "fontFamily": "inherit"
  }',
  submission_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE INDEX idx_standalone_forms_user_id ON standalone_forms(user_id);
CREATE INDEX idx_standalone_forms_slug ON standalone_forms(slug);
CREATE INDEX idx_standalone_forms_status ON standalone_forms(status);

-- Standalone form submissions
CREATE TABLE standalone_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES standalone_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  form_data JSONB NOT NULL,
  utm_params JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_standalone_form_submissions_form_id ON standalone_form_submissions(form_id);
CREATE INDEX idx_standalone_form_submissions_contact_id ON standalone_form_submissions(contact_id);
CREATE INDEX idx_standalone_form_submissions_submitted_at ON standalone_form_submissions(submitted_at);

-- ============================================
-- CONTACT TIMELINE VIEW
-- ============================================

-- Activity log for contact timeline (aggregates all activities)
CREATE TABLE contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'email_sent', 'email_opened', 'email_clicked', 'email_bounced', 'form_submitted', 'chat_started', 'chat_message', 'tag_added', 'tag_removed', 'scenario_enrolled', 'note_added', 'contact_created'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  reference_type VARCHAR(50), -- 'message', 'campaign', 'form_submission', 'chat_conversation', 'scenario'
  reference_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX idx_contact_activities_user_id ON contact_activities(user_id);
CREATE INDEX idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX idx_contact_activities_occurred_at ON contact_activities(occurred_at);
CREATE INDEX idx_contact_activities_reference ON contact_activities(reference_type, reference_id);

-- Contact notes (manual notes added by agents)
CREATE TABLE contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_notes_contact_id ON contact_notes(contact_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_chat_widgets_updated_at
  BEFORE UPDATE ON chat_widgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_standalone_forms_updated_at
  BEFORE UPDATE ON standalone_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_notes_updated_at
  BEFORE UPDATE ON contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create contact from standalone form submission
CREATE OR REPLACE FUNCTION create_contact_from_standalone_form()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_first_name TEXT;
  v_contact_id UUID;
  v_form_user_id UUID;
BEGIN
  v_email := NEW.form_data->>'email';
  v_first_name := COALESCE(NEW.form_data->>'name', NEW.form_data->>'first_name');

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_form_user_id
  FROM standalone_forms
  WHERE id = NEW.form_id;

  SELECT id INTO v_contact_id
  FROM contacts
  WHERE user_id = v_form_user_id AND email = v_email;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (user_id, email, first_name, status)
    VALUES (v_form_user_id, v_email, v_first_name, 'active')
    RETURNING id INTO v_contact_id;
  END IF;

  NEW.contact_id := v_contact_id;
  NEW.user_id := v_form_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_contact_from_standalone_form
  BEFORE INSERT ON standalone_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION create_contact_from_standalone_form();

-- Auto-link chat visitor to contact
CREATE OR REPLACE FUNCTION link_chat_visitor_to_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_widget_user_id UUID;
  v_contact_id UUID;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_widget_user_id
  FROM chat_widgets
  WHERE id = NEW.widget_id;

  SELECT id INTO v_contact_id
  FROM contacts
  WHERE user_id = v_widget_user_id AND email = NEW.email;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (user_id, email, first_name, status)
    VALUES (v_widget_user_id, NEW.email, NEW.name, 'active')
    RETURNING id INTO v_contact_id;
  END IF;

  NEW.contact_id := v_contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_link_chat_visitor_to_contact
  BEFORE INSERT ON chat_visitors
  FOR EACH ROW
  EXECUTE FUNCTION link_chat_visitor_to_contact();

-- Increment form submission count
CREATE OR REPLACE FUNCTION increment_form_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE standalone_forms
  SET submission_count = submission_count + 1
  WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_form_submission_count
  AFTER INSERT ON standalone_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION increment_form_submission_count();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE chat_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE standalone_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE standalone_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

-- Chat widgets
CREATE POLICY "Users can manage own chat widgets" ON chat_widgets
  FOR ALL USING (auth.uid() = user_id);

-- Chat visitors (through widgets)
CREATE POLICY "Users can view own widget visitors" ON chat_visitors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_widgets WHERE chat_widgets.id = widget_id AND chat_widgets.user_id = auth.uid())
  );
CREATE POLICY "Anyone can insert chat visitors" ON chat_visitors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_widgets WHERE chat_widgets.id = widget_id AND chat_widgets.is_active = TRUE)
  );

-- Chat conversations (through widgets)
CREATE POLICY "Users can manage own widget conversations" ON chat_conversations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM chat_widgets WHERE chat_widgets.id = widget_id AND chat_widgets.user_id = auth.uid())
  );
CREATE POLICY "Anyone can insert conversations for active widgets" ON chat_conversations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_widgets WHERE chat_widgets.id = widget_id AND chat_widgets.is_active = TRUE)
  );

-- Chat messages (through conversations)
CREATE POLICY "Users can view own conversation messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_conversations cc
      JOIN chat_widgets cw ON cw.id = cc.widget_id
      WHERE cc.id = conversation_id AND cw.user_id = auth.uid()
    )
  );
CREATE POLICY "Anyone can insert messages to active conversations" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations WHERE chat_conversations.id = conversation_id AND chat_conversations.status IN ('open', 'assigned')
    )
  );

-- Standalone forms
CREATE POLICY "Users can manage own standalone forms" ON standalone_forms
  FOR ALL USING (auth.uid() = user_id);
-- Public access for active forms
CREATE POLICY "Anyone can view active forms by slug" ON standalone_forms
  FOR SELECT USING (status = 'active');

-- Standalone form submissions
CREATE POLICY "Users can view own form submissions" ON standalone_form_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can submit to active forms" ON standalone_form_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM standalone_forms WHERE standalone_forms.id = form_id AND standalone_forms.status = 'active')
  );

-- Contact activities
CREATE POLICY "Users can manage own contact activities" ON contact_activities
  FOR ALL USING (auth.uid() = user_id);

-- Contact notes
CREATE POLICY "Users can manage own contact notes" ON contact_notes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SERVICE ROLE POLICIES (for background jobs)
-- ============================================

CREATE POLICY "Service role can manage chat visitors" ON chat_visitors
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage chat conversations" ON chat_conversations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage chat messages" ON chat_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage form submissions" ON standalone_form_submissions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage contact activities" ON contact_activities
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
