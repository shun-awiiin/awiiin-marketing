-- Email Deliverability Schema Migration
-- Version: 1.0.0
-- Date: 2026-01-24

-- ============================================
-- NEW ENUMS
-- ============================================

CREATE TYPE email_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE engagement_level AS ENUM ('highly_engaged', 'engaged', 'neutral', 'disengaged', 'inactive');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE auth_status AS ENUM ('pass', 'fail', 'partial', 'unknown');

-- ============================================
-- NEW TABLES
-- ============================================

-- Email validation results cache
CREATE TABLE email_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    syntax_valid BOOLEAN NOT NULL DEFAULT FALSE,
    mx_valid BOOLEAN,
    mx_records JSONB DEFAULT '[]'::jsonb,
    is_disposable BOOLEAN DEFAULT FALSE,
    is_role_based BOOLEAN DEFAULT FALSE,
    is_free_provider BOOLEAN DEFAULT FALSE,
    risk_level email_risk_level NOT NULL DEFAULT 'medium',
    risk_score INT NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
    validation_details JSONB DEFAULT '{}'::jsonb,
    validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disposable email domains list
CREATE TABLE disposable_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    source VARCHAR(100) DEFAULT 'manual',
    confidence INT DEFAULT 100 CHECK (confidence >= 0 AND confidence <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain health records
CREATE TABLE domain_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    spf_status auth_status NOT NULL DEFAULT 'unknown',
    spf_record TEXT,
    dkim_status auth_status NOT NULL DEFAULT 'unknown',
    dkim_selector VARCHAR(100),
    dkim_record TEXT,
    dmarc_status auth_status NOT NULL DEFAULT 'unknown',
    dmarc_record TEXT,
    dmarc_policy VARCHAR(20),
    health_score INT NOT NULL DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
    recommendations JSONB DEFAULT '[]'::jsonb,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- Daily reputation metrics
CREATE TABLE reputation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    total_sent INT NOT NULL DEFAULT 0,
    total_delivered INT NOT NULL DEFAULT 0,
    total_bounced INT NOT NULL DEFAULT 0,
    total_complained INT NOT NULL DEFAULT 0,
    total_opened INT NOT NULL DEFAULT 0,
    total_clicked INT NOT NULL DEFAULT 0,
    delivery_rate NUMERIC(5,2) DEFAULT 0,
    bounce_rate NUMERIC(5,2) DEFAULT 0,
    complaint_rate NUMERIC(5,3) DEFAULT 0,
    open_rate NUMERIC(5,2) DEFAULT 0,
    click_rate NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, domain, date)
);

-- Deliverability alerts
CREATE TABLE deliverability_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    severity alert_severity NOT NULL DEFAULT 'info',
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    action_label VARCHAR(100),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content check results
CREATE TABLE content_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(200),
    body_preview TEXT,
    overall_score INT NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
    spam_score INT NOT NULL DEFAULT 0 CHECK (spam_score >= 0 AND spam_score <= 100),
    spam_words_found JSONB DEFAULT '[]'::jsonb,
    links_found JSONB DEFAULT '[]'::jsonb,
    links_valid BOOLEAN DEFAULT TRUE,
    html_text_ratio NUMERIC(5,2),
    subject_score INT DEFAULT 0 CHECK (subject_score >= 0 AND subject_score <= 100),
    recommendations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain warmup tracking
CREATE TABLE domain_warmup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_day INT NOT NULL DEFAULT 1 CHECK (current_day >= 1),
    current_daily_limit INT NOT NULL DEFAULT 50,
    target_daily_limit INT NOT NULL DEFAULT 10000,
    warmup_schedule JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Extend contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score INT DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_level engagement_level DEFAULT 'neutral';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_open_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_click_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_opens INT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_clicks INT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_sent INT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS validation_status email_risk_level;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Extend messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS open_count INT DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS click_count INT DEFAULT 0;

-- ============================================
-- INDEXES
-- ============================================

-- Email validations
CREATE INDEX idx_email_validations_email ON email_validations(email);
CREATE INDEX idx_email_validations_risk_level ON email_validations(risk_level);
CREATE INDEX idx_email_validations_validated_at ON email_validations(validated_at);

-- Disposable domains
CREATE INDEX idx_disposable_domains_domain ON disposable_domains(domain);

-- Domain health
CREATE INDEX idx_domain_health_user_id ON domain_health(user_id);
CREATE INDEX idx_domain_health_domain ON domain_health(domain);
CREATE INDEX idx_domain_health_health_score ON domain_health(health_score);

-- Reputation metrics
CREATE INDEX idx_reputation_metrics_user_id ON reputation_metrics(user_id);
CREATE INDEX idx_reputation_metrics_domain ON reputation_metrics(domain);
CREATE INDEX idx_reputation_metrics_date ON reputation_metrics(date);
CREATE INDEX idx_reputation_metrics_user_domain_date ON reputation_metrics(user_id, domain, date);

-- Deliverability alerts
CREATE INDEX idx_deliverability_alerts_user_id ON deliverability_alerts(user_id);
CREATE INDEX idx_deliverability_alerts_severity ON deliverability_alerts(severity);
CREATE INDEX idx_deliverability_alerts_is_read ON deliverability_alerts(is_read);
CREATE INDEX idx_deliverability_alerts_created_at ON deliverability_alerts(created_at);

-- Content checks
CREATE INDEX idx_content_checks_campaign_id ON content_checks(campaign_id);
CREATE INDEX idx_content_checks_user_id ON content_checks(user_id);
CREATE INDEX idx_content_checks_overall_score ON content_checks(overall_score);

-- Domain warmup
CREATE INDEX idx_domain_warmup_user_id ON domain_warmup(user_id);
CREATE INDEX idx_domain_warmup_domain ON domain_warmup(domain);
CREATE INDEX idx_domain_warmup_is_active ON domain_warmup(is_active);

-- Contacts engagement indexes
CREATE INDEX idx_contacts_engagement_score ON contacts(engagement_score);
CREATE INDEX idx_contacts_engagement_level ON contacts(engagement_level);
CREATE INDEX idx_contacts_validation_status ON contacts(validation_status);
CREATE INDEX idx_contacts_last_open_at ON contacts(last_open_at);

-- Messages open/click indexes
CREATE INDEX idx_messages_opened_at ON messages(opened_at);
CREATE INDEX idx_messages_clicked_at ON messages(clicked_at);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_email_validations_updated_at
    BEFORE UPDATE ON email_validations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_health_updated_at
    BEFORE UPDATE ON domain_health
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reputation_metrics_updated_at
    BEFORE UPDATE ON reputation_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_warmup_updated_at
    BEFORE UPDATE ON domain_warmup
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE email_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposable_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverability_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_warmup ENABLE ROW LEVEL SECURITY;

-- Email validations: service role only for write, all can read (cached data)
CREATE POLICY "Anyone can view email validations" ON email_validations
    FOR SELECT USING (TRUE);

-- Disposable domains: public read
CREATE POLICY "Anyone can view disposable domains" ON disposable_domains
    FOR SELECT USING (TRUE);

-- Domain health: user can only see their own
CREATE POLICY "Users can view own domain health" ON domain_health
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own domain health" ON domain_health
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own domain health" ON domain_health
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own domain health" ON domain_health
    FOR DELETE USING (auth.uid() = user_id);

-- Reputation metrics: user can only see their own
CREATE POLICY "Users can view own reputation metrics" ON reputation_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reputation metrics" ON reputation_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reputation metrics" ON reputation_metrics
    FOR UPDATE USING (auth.uid() = user_id);

-- Deliverability alerts: user can only see their own
CREATE POLICY "Users can view own alerts" ON deliverability_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON deliverability_alerts
    FOR UPDATE USING (auth.uid() = user_id);

-- Content checks: user can only see their own
CREATE POLICY "Users can view own content checks" ON content_checks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content checks" ON content_checks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Domain warmup: user can only see their own
CREATE POLICY "Users can view own warmup" ON domain_warmup
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own warmup" ON domain_warmup
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own warmup" ON domain_warmup
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA: Common Disposable Domains
-- ============================================

INSERT INTO disposable_domains (domain, source, confidence) VALUES
('tempmail.com', 'built-in', 100),
('guerrillamail.com', 'built-in', 100),
('10minutemail.com', 'built-in', 100),
('mailinator.com', 'built-in', 100),
('throwaway.email', 'built-in', 100),
('temp-mail.org', 'built-in', 100),
('fakeinbox.com', 'built-in', 100),
('trashmail.com', 'built-in', 100),
('tempail.com', 'built-in', 100),
('dispostable.com', 'built-in', 100),
('yopmail.com', 'built-in', 100),
('getnada.com', 'built-in', 100),
('maildrop.cc', 'built-in', 100),
('sharklasers.com', 'built-in', 100),
('spam4.me', 'built-in', 100),
('grr.la', 'built-in', 100),
('emailondeck.com', 'built-in', 100),
('mohmal.com', 'built-in', 100),
('tempinbox.com', 'built-in', 100),
('burnermail.io', 'built-in', 100)
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate engagement score for a contact
CREATE OR REPLACE FUNCTION calculate_engagement_score(
    p_total_sent INT,
    p_total_opens INT,
    p_total_clicks INT,
    p_last_open_at TIMESTAMPTZ,
    p_last_click_at TIMESTAMPTZ
)
RETURNS INT AS $$
DECLARE
    v_score INT := 50;
    v_open_rate NUMERIC;
    v_click_rate NUMERIC;
    v_recency_bonus INT := 0;
    v_last_engagement TIMESTAMPTZ;
BEGIN
    -- Base score from engagement rates
    IF p_total_sent > 0 THEN
        v_open_rate := (p_total_opens::NUMERIC / p_total_sent) * 100;
        v_click_rate := (p_total_clicks::NUMERIC / p_total_sent) * 100;

        -- Open rate contribution (max 30 points)
        v_score := v_score + LEAST(30, v_open_rate * 1.5)::INT;

        -- Click rate contribution (max 20 points)
        v_score := v_score + LEAST(20, v_click_rate * 4)::INT;
    END IF;

    -- Recency bonus
    v_last_engagement := GREATEST(COALESCE(p_last_open_at, '1970-01-01'), COALESCE(p_last_click_at, '1970-01-01'));

    IF v_last_engagement > NOW() - INTERVAL '7 days' THEN
        v_recency_bonus := 15;
    ELSIF v_last_engagement > NOW() - INTERVAL '30 days' THEN
        v_recency_bonus := 10;
    ELSIF v_last_engagement > NOW() - INTERVAL '90 days' THEN
        v_recency_bonus := 5;
    ELSIF v_last_engagement < NOW() - INTERVAL '180 days' AND v_last_engagement > '1970-01-01' THEN
        v_recency_bonus := -20;
    END IF;

    v_score := v_score + v_recency_bonus;

    -- Clamp to 0-100
    RETURN GREATEST(0, LEAST(100, v_score));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Determine engagement level from score
CREATE OR REPLACE FUNCTION get_engagement_level(p_score INT)
RETURNS engagement_level AS $$
BEGIN
    IF p_score >= 80 THEN
        RETURN 'highly_engaged';
    ELSIF p_score >= 60 THEN
        RETURN 'engaged';
    ELSIF p_score >= 40 THEN
        RETURN 'neutral';
    ELSIF p_score >= 20 THEN
        RETURN 'disengaged';
    ELSE
        RETURN 'inactive';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get deliverability score for a user/domain
CREATE OR REPLACE FUNCTION get_deliverability_score(p_user_id UUID, p_domain VARCHAR DEFAULT NULL)
RETURNS TABLE (
    overall_score INT,
    grade CHAR(1),
    domain_health_score INT,
    list_quality_score INT,
    engagement_score INT,
    reputation_score INT,
    content_score INT
) AS $$
DECLARE
    v_domain_health INT := 0;
    v_list_quality INT := 0;
    v_engagement INT := 0;
    v_reputation INT := 0;
    v_content INT := 0;
    v_overall INT;
    v_grade CHAR(1);
BEGIN
    -- Domain health score (average of user's domains)
    SELECT COALESCE(AVG(health_score), 0)::INT INTO v_domain_health
    FROM domain_health
    WHERE user_id = p_user_id
    AND (p_domain IS NULL OR domain = p_domain);

    -- List quality score (based on validation and bounce rates)
    SELECT
        CASE
            WHEN COUNT(*) = 0 THEN 50
            ELSE (
                (COUNT(*) FILTER (WHERE status = 'active' AND (validation_status IS NULL OR validation_status IN ('low', 'medium')))::NUMERIC / COUNT(*)::NUMERIC) * 100
            )::INT
        END INTO v_list_quality
    FROM contacts
    WHERE user_id = p_user_id;

    -- Engagement score (average of active contacts)
    SELECT COALESCE(AVG(engagement_score), 50)::INT INTO v_engagement
    FROM contacts
    WHERE user_id = p_user_id AND status = 'active';

    -- Reputation score (from recent metrics)
    SELECT
        CASE
            WHEN SUM(total_sent) = 0 THEN 50
            ELSE LEAST(100, GREATEST(0,
                100
                - (SUM(total_bounced)::NUMERIC / NULLIF(SUM(total_sent), 0) * 100 * 10)
                - (SUM(total_complained)::NUMERIC / NULLIF(SUM(total_sent), 0) * 100 * 50)
            ))::INT
        END INTO v_reputation
    FROM reputation_metrics
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '30 days'
    AND (p_domain IS NULL OR domain = p_domain);

    -- Content score (average of recent content checks)
    SELECT COALESCE(AVG(overall_score), 70)::INT INTO v_content
    FROM content_checks
    WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '30 days';

    -- Calculate overall score (weighted average)
    v_overall := (
        v_domain_health * 0.25 +
        v_list_quality * 0.25 +
        v_engagement * 0.20 +
        v_reputation * 0.20 +
        v_content * 0.10
    )::INT;

    -- Determine grade
    IF v_overall >= 90 THEN v_grade := 'A';
    ELSIF v_overall >= 80 THEN v_grade := 'B';
    ELSIF v_overall >= 70 THEN v_grade := 'C';
    ELSIF v_overall >= 60 THEN v_grade := 'D';
    ELSE v_grade := 'F';
    END IF;

    RETURN QUERY SELECT
        v_overall,
        v_grade,
        v_domain_health,
        v_list_quality,
        v_engagement,
        v_reputation,
        v_content;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update daily reputation metrics
CREATE OR REPLACE FUNCTION update_daily_reputation_metrics(
    p_user_id UUID,
    p_domain VARCHAR,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
    v_sent INT;
    v_delivered INT;
    v_bounced INT;
    v_complained INT;
    v_opened INT;
    v_clicked INT;
BEGIN
    -- Count messages for the day
    SELECT
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'bounced', 'complained')),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status = 'bounced'),
        COUNT(*) FILTER (WHERE status = 'complained'),
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL),
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)
    INTO v_sent, v_delivered, v_bounced, v_complained, v_opened, v_clicked
    FROM messages m
    JOIN campaigns c ON m.campaign_id = c.id
    WHERE c.user_id = p_user_id
    AND c.from_email LIKE '%@' || p_domain
    AND DATE(m.sent_at) = p_date;

    -- Upsert metrics
    INSERT INTO reputation_metrics (
        user_id, domain, date,
        total_sent, total_delivered, total_bounced, total_complained,
        total_opened, total_clicked,
        delivery_rate, bounce_rate, complaint_rate, open_rate, click_rate
    ) VALUES (
        p_user_id, p_domain, p_date,
        v_sent, v_delivered, v_bounced, v_complained,
        v_opened, v_clicked,
        CASE WHEN v_sent > 0 THEN (v_delivered::NUMERIC / v_sent * 100) ELSE 0 END,
        CASE WHEN v_sent > 0 THEN (v_bounced::NUMERIC / v_sent * 100) ELSE 0 END,
        CASE WHEN v_sent > 0 THEN (v_complained::NUMERIC / v_sent * 100) ELSE 0 END,
        CASE WHEN v_delivered > 0 THEN (v_opened::NUMERIC / v_delivered * 100) ELSE 0 END,
        CASE WHEN v_opened > 0 THEN (v_clicked::NUMERIC / v_opened * 100) ELSE 0 END
    )
    ON CONFLICT (user_id, domain, date) DO UPDATE SET
        total_sent = EXCLUDED.total_sent,
        total_delivered = EXCLUDED.total_delivered,
        total_bounced = EXCLUDED.total_bounced,
        total_complained = EXCLUDED.total_complained,
        total_opened = EXCLUDED.total_opened,
        total_clicked = EXCLUDED.total_clicked,
        delivery_rate = EXCLUDED.delivery_rate,
        bounce_rate = EXCLUDED.bounce_rate,
        complaint_rate = EXCLUDED.complaint_rate,
        open_rate = EXCLUDED.open_rate,
        click_rate = EXCLUDED.click_rate,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
