-- HubSpot Alternative Email Tool - Initial Schema
-- Version: 1.0.0
-- Date: 2026-01-23

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE contact_status AS ENUM ('active', 'bounced', 'complained', 'unsubscribed');
CREATE TYPE template_type AS ENUM ('SEMINAR_INVITE', 'FREE_TRIAL_INVITE');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'queued', 'sending', 'paused', 'completed', 'stopped', 'failed');
CREATE TYPE message_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'failed');

-- ============================================
-- TABLES
-- ============================================

-- Users (extends Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'editor',
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    company VARCHAR(200),
    status contact_status NOT NULL DEFAULT 'active',
    soft_bounce_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Contact Tags (Junction)
CREATE TABLE contact_tags (
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contact_id, tag_id)
);

-- Templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for presets
    name VARCHAR(100) NOT NULL,
    type template_type NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'custom',
    subject_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
    body_text TEXT NOT NULL,
    body_html TEXT, -- For future use
    is_preset BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    template_id UUID NOT NULL REFERENCES templates(id),
    type template_type NOT NULL,
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    subject_override VARCHAR(200),
    body_override TEXT,
    variables JSONB DEFAULT '{}'::jsonb,
    filter_tags UUID[] DEFAULT '{}',
    from_name VARCHAR(100) NOT NULL DEFAULT 'Awiiin',
    from_email VARCHAR(255) NOT NULL DEFAULT 'info@m.awiiin.com',
    rate_limit_per_minute INT NOT NULL DEFAULT 20,
    status campaign_status NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    stop_reason VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(200) NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    status message_status NOT NULL DEFAULT 'queued',
    provider_message_id VARCHAR(255),
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events (Webhook events log)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL DEFAULT 'ses',
    provider_message_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    payload JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unsubscribes
CREATE TABLE unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    token VARCHAR(64) UNIQUE,
    reason VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    payload JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Contacts
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Tags
CREATE INDEX idx_tags_user_id ON tags(user_id);

-- Contact Tags
CREATE INDEX idx_contact_tags_tag_id ON contact_tags(tag_id);

-- Templates
CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_templates_type ON templates(type);
CREATE INDEX idx_templates_is_preset ON templates(is_preset);

-- Campaigns
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled_at ON campaigns(scheduled_at);

-- Messages
CREATE INDEX idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_provider_message_id ON messages(provider_message_id);

-- Events
CREATE INDEX idx_events_provider_message_id ON events(provider_message_id);
CREATE INDEX idx_events_campaign_id ON events(campaign_id);
CREATE INDEX idx_events_email ON events(email);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_occurred_at ON events(occurred_at);

-- Unsubscribes
CREATE INDEX idx_unsubscribes_token ON unsubscribes(token);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users: can only see own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Contacts: user can only see their own contacts
CREATE POLICY "Users can view own contacts" ON contacts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts" ON contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts" ON contacts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts" ON contacts
    FOR DELETE USING (auth.uid() = user_id);

-- Tags: user can only see their own tags
CREATE POLICY "Users can view own tags" ON tags
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON tags
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON tags
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON tags
    FOR DELETE USING (auth.uid() = user_id);

-- Contact Tags: user can manage their contact's tags
CREATE POLICY "Users can view own contact_tags" ON contact_tags
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
    );

CREATE POLICY "Users can insert own contact_tags" ON contact_tags
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
    );

CREATE POLICY "Users can delete own contact_tags" ON contact_tags
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_id AND contacts.user_id = auth.uid())
    );

-- Templates: user can see presets + own templates
CREATE POLICY "Users can view templates" ON templates
    FOR SELECT USING (is_preset = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON templates
    FOR UPDATE USING (auth.uid() = user_id AND is_preset = FALSE);

CREATE POLICY "Users can delete own templates" ON templates
    FOR DELETE USING (auth.uid() = user_id AND is_preset = FALSE);

-- Campaigns: user can only see their own campaigns
CREATE POLICY "Users can view own campaigns" ON campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns" ON campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Messages: user can only see messages from their campaigns
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_id AND campaigns.user_id = auth.uid())
    );

CREATE POLICY "Users can insert own messages" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_id AND campaigns.user_id = auth.uid())
    );

CREATE POLICY "Users can update own messages" ON messages
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_id AND campaigns.user_id = auth.uid())
    );

-- Events: user can only see events from their campaigns
CREATE POLICY "Users can view own events" ON events
    FOR SELECT USING (
        campaign_id IS NULL OR
        EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_id AND campaigns.user_id = auth.uid())
    );

-- Unsubscribes: service role only for insert/update, user can view
CREATE POLICY "Users can view unsubscribes" ON unsubscribes
    FOR SELECT USING (TRUE);

-- Audit Logs: user can only see their own logs
CREATE POLICY "Users can view own audit_logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA: Preset Templates
-- ============================================

INSERT INTO templates (id, user_id, name, type, category, subject_variants, body_text, is_preset, is_active) VALUES
(
    gen_random_uuid(),
    NULL,
    'セミナー案内（標準）',
    'SEMINAR_INVITE',
    'seminar',
    '["{{firstName}}さん、1点だけ共有です", "{{firstName}}さん向けにご連絡です（短時間）", "{{firstName}}さん、来週の件でご案内です"]'::jsonb,
    '{{firstName}}さん

お世話になっております。
Awiiinの菊池です。

{{event_name}}を開催することになりました。
{{event_date}}
{{event_location}}

もしご興味あればご参加ください。
{{url}}

{{#extra_bullets}}
{{.}}
{{/extra_bullets}}

不要でしたら無視で大丈夫です。

Awiiin
菊池',
    TRUE,
    TRUE
),
(
    gen_random_uuid(),
    NULL,
    '無料登録案内（標準）',
    'FREE_TRIAL_INVITE',
    'registration',
    '["{{firstName}}さん、先日の件で1点だけ", "{{firstName}}さん向けに共有です", "{{firstName}}さん、ご参考までに"]'::jsonb,
    '{{firstName}}さん

先日はありがとうございました。
Awiiinの菊池です。

その後、何名かの方から「試してみたい」という声があったので
一応共有です。

{{tool_name}}：{{one_liner}}

こちらから確認できます。
{{url}}

{{#extra_bullets}}
{{.}}
{{/extra_bullets}}

不要でしたら無視で大丈夫です。

Awiiin
菊池',
    TRUE,
    TRUE
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get campaign stats
CREATE OR REPLACE FUNCTION get_campaign_stats(p_campaign_id UUID)
RETURNS TABLE (
    total BIGINT,
    queued BIGINT,
    sending BIGINT,
    sent BIGINT,
    delivered BIGINT,
    bounced BIGINT,
    complained BIGINT,
    failed BIGINT,
    bounce_rate NUMERIC,
    complaint_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE m.status = 'queued')::BIGINT as queued,
        COUNT(*) FILTER (WHERE m.status = 'sending')::BIGINT as sending,
        COUNT(*) FILTER (WHERE m.status = 'sent')::BIGINT as sent,
        COUNT(*) FILTER (WHERE m.status = 'delivered')::BIGINT as delivered,
        COUNT(*) FILTER (WHERE m.status = 'bounced')::BIGINT as bounced,
        COUNT(*) FILTER (WHERE m.status = 'complained')::BIGINT as complained,
        COUNT(*) FILTER (WHERE m.status = 'failed')::BIGINT as failed,
        CASE
            WHEN COUNT(*) FILTER (WHERE m.status IN ('sent', 'delivered', 'bounced', 'complained')) > 0
            THEN ROUND(
                COUNT(*) FILTER (WHERE m.status = 'bounced')::NUMERIC /
                COUNT(*) FILTER (WHERE m.status IN ('sent', 'delivered', 'bounced', 'complained'))::NUMERIC * 100,
                2
            )
            ELSE 0
        END as bounce_rate,
        CASE
            WHEN COUNT(*) FILTER (WHERE m.status IN ('sent', 'delivered', 'bounced', 'complained')) > 0
            THEN ROUND(
                COUNT(*) FILTER (WHERE m.status = 'complained')::NUMERIC /
                COUNT(*) FILTER (WHERE m.status IN ('sent', 'delivered', 'bounced', 'complained'))::NUMERIC * 100,
                2
            )
            ELSE 0
        END as complaint_rate
    FROM messages m
    WHERE m.campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if campaign should auto-stop
CREATE OR REPLACE FUNCTION should_auto_stop_campaign(p_campaign_id UUID)
RETURNS TABLE (
    should_stop BOOLEAN,
    reason VARCHAR(200)
) AS $$
DECLARE
    v_bounce_rate NUMERIC;
    v_complaint_rate NUMERIC;
    v_sent_count BIGINT;
BEGIN
    SELECT
        bounce_rate,
        complaint_rate,
        sent + delivered + bounced + complained
    INTO v_bounce_rate, v_complaint_rate, v_sent_count
    FROM get_campaign_stats(p_campaign_id);

    -- Need at least 20 sent to check rates
    IF v_sent_count < 20 THEN
        RETURN QUERY SELECT FALSE, NULL::VARCHAR(200);
        RETURN;
    END IF;

    -- Check bounce rate >= 5%
    IF v_bounce_rate >= 5 THEN
        RETURN QUERY SELECT TRUE, 'バウンス率が5%を超えました'::VARCHAR(200);
        RETURN;
    END IF;

    -- Check complaint rate >= 0.1%
    IF v_complaint_rate >= 0.1 THEN
        RETURN QUERY SELECT TRUE, '苦情率が0.1%を超えました'::VARCHAR(200);
        RETURN;
    END IF;

    RETURN QUERY SELECT FALSE, NULL::VARCHAR(200);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
