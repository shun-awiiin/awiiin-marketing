-- Phase 1: Conversion Tracking Schema
-- Tracks visitor journeys from click to conversion

-- Funnels (conversion paths)
CREATE TABLE IF NOT EXISTS funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Funnel step types
CREATE TYPE funnel_step_type AS ENUM ('landing_page', 'opt_in', 'purchase', 'thank_you', 'upsell');

-- Funnel Steps (ordered stages in funnel)
CREATE TABLE IF NOT EXISTS funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  step_type funnel_step_type NOT NULL,
  step_order INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  page_id UUID, -- References landing_pages when created
  target_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Visitors (anonymous tracking)
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint VARCHAR(64),
  cookie_id VARCHAR(64),
  ip_address INET,
  user_agent TEXT,
  first_utm JSONB DEFAULT '{}', -- {source, medium, campaign, term, content}
  first_referrer TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversion event types
CREATE TYPE conversion_event_type AS ENUM ('page_view', 'click', 'opt_in', 'purchase', 'upsell_accepted', 'upsell_declined');

-- Conversion Events
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
  step_id UUID REFERENCES funnel_steps(id) ON DELETE SET NULL,
  event_type conversion_event_type NOT NULL,
  page_url TEXT,
  utm_params JSONB DEFAULT '{}',
  referrer_code VARCHAR(50), -- Affiliate code
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily aggregated stats for performance
CREATE TABLE IF NOT EXISTS funnel_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  step_id UUID REFERENCES funnel_steps(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  visitors INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  UNIQUE(funnel_id, step_id, date)
);

-- Tracking Links (short URLs with UTM)
CREATE TYPE tracking_link_status AS ENUM ('active', 'paused', 'expired');

CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(20) UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(200),
  utm_content VARCHAR(200),
  utm_term VARCHAR(200),
  funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  status tracking_link_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link Clicks (detailed click tracking)
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id UUID NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_funnels_user_id ON funnels(user_id);
CREATE INDEX IF NOT EXISTS idx_funnel_steps_funnel_id ON funnel_steps(funnel_id);
CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON visitors(user_id);
CREATE INDEX IF NOT EXISTS idx_visitors_cookie_id ON visitors(cookie_id);
CREATE INDEX IF NOT EXISTS idx_visitors_fingerprint ON visitors(fingerprint);
CREATE INDEX IF NOT EXISTS idx_conversion_events_user_id ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_visitor_id ON conversion_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_funnel_id ON conversion_events(funnel_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_occurred_at ON conversion_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_funnel_daily_stats_funnel_date ON funnel_daily_stats(funnel_id, date);
CREATE INDEX IF NOT EXISTS idx_tracking_links_user_id ON tracking_links(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_short_code ON tracking_links(short_code);
CREATE INDEX IF NOT EXISTS idx_link_clicks_tracking_link_id ON link_clicks(tracking_link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);

-- RLS Policies
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Funnels policies
CREATE POLICY "Users can view own funnels" ON funnels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funnels" ON funnels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funnels" ON funnels
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own funnels" ON funnels
  FOR DELETE USING (auth.uid() = user_id);

-- Funnel steps policies
CREATE POLICY "Users can view own funnel steps" ON funnel_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_steps.funnel_id AND funnels.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own funnel steps" ON funnel_steps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_steps.funnel_id AND funnels.user_id = auth.uid())
  );
CREATE POLICY "Users can update own funnel steps" ON funnel_steps
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_steps.funnel_id AND funnels.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own funnel steps" ON funnel_steps
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_steps.funnel_id AND funnels.user_id = auth.uid())
  );

-- Visitors policies
CREATE POLICY "Users can view own visitors" ON visitors
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own visitors" ON visitors
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own visitors" ON visitors
  FOR UPDATE USING (auth.uid() = user_id);

-- Conversion events policies
CREATE POLICY "Users can view own conversion events" ON conversion_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversion events" ON conversion_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Funnel daily stats policies
CREATE POLICY "Users can view own funnel stats" ON funnel_daily_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funnel stats" ON funnel_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funnel stats" ON funnel_daily_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Tracking links policies
CREATE POLICY "Users can view own tracking links" ON tracking_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracking links" ON tracking_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracking links" ON tracking_links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracking links" ON tracking_links
  FOR DELETE USING (auth.uid() = user_id);

-- Link clicks policies
CREATE POLICY "Users can view own link clicks" ON link_clicks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tracking_links WHERE tracking_links.id = link_clicks.tracking_link_id AND tracking_links.user_id = auth.uid())
  );
CREATE POLICY "Users can insert link clicks" ON link_clicks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tracking_links WHERE tracking_links.id = link_clicks.tracking_link_id)
  );

-- Service role policies for public tracking endpoints
CREATE POLICY "Service role can manage visitors" ON visitors
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage conversion events" ON conversion_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage link clicks" ON link_clicks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to increment tracking link click count
CREATE OR REPLACE FUNCTION increment_tracking_link_clicks(link_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE tracking_links
  SET click_count = click_count + 1,
      updated_at = NOW()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get funnel conversion stats
CREATE OR REPLACE FUNCTION get_funnel_stats(p_funnel_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  step_id UUID,
  step_name VARCHAR,
  step_order INTEGER,
  total_visitors BIGINT,
  total_conversions BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fs.id AS step_id,
    fs.name AS step_name,
    fs.step_order,
    COALESCE(SUM(fds.visitors), 0)::BIGINT AS total_visitors,
    COALESCE(SUM(fds.conversions), 0)::BIGINT AS total_conversions,
    CASE
      WHEN COALESCE(SUM(fds.visitors), 0) > 0
      THEN ROUND(COALESCE(SUM(fds.conversions), 0)::NUMERIC / COALESCE(SUM(fds.visitors), 0)::NUMERIC * 100, 2)
      ELSE 0
    END AS conversion_rate
  FROM funnel_steps fs
  LEFT JOIN funnel_daily_stats fds ON fds.step_id = fs.id
    AND fds.date BETWEEN p_start_date AND p_end_date
  WHERE fs.funnel_id = p_funnel_id
  GROUP BY fs.id, fs.name, fs.step_order
  ORDER BY fs.step_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
