-- Social Media Posting Feature Schema
-- Supports X (Twitter), Instagram, YouTube, WhatsApp

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE social_provider AS ENUM ('x', 'instagram', 'youtube', 'whatsapp');
CREATE TYPE social_account_status AS ENUM ('active', 'inactive', 'expired', 'revoked');
CREATE TYPE social_post_status AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
CREATE TYPE social_asset_type AS ENUM ('image', 'video', 'carousel');
CREATE TYPE social_asset_status AS ENUM ('uploading', 'processing', 'ready', 'failed');

-- ============================================
-- TABLES
-- ============================================

-- OAuth States (CSRF protection for OAuth flows)
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform social_provider NOT NULL,
  state VARCHAR(64) UNIQUE NOT NULL,
  code_verifier VARCHAR(128),
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_states_state ON oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);
CREATE INDEX idx_oauth_states_user ON oauth_states(user_id);

-- Social Accounts (multi-provider)
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider social_provider NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  username VARCHAR(255),
  profile_image_url TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_iv BYTEA NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  status social_account_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  last_validated_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, provider_account_id)
);

CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX idx_social_accounts_provider ON social_accounts(provider);
CREATE INDEX idx_social_accounts_status ON social_accounts(status);

-- Social Posts
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status social_post_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at)
  WHERE status = 'scheduled';

-- Post Channel Targets (one post -> many channels)
CREATE TABLE post_channel_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  provider social_provider NOT NULL,
  channel_config JSONB NOT NULL DEFAULT '{}',
  provider_post_id VARCHAR(255),
  status social_post_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  engagement_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, account_id)
);

CREATE INDEX idx_channel_targets_post ON post_channel_targets(post_id);
CREATE INDEX idx_channel_targets_account ON post_channel_targets(account_id);
CREATE INDEX idx_channel_targets_status ON post_channel_targets(status);
CREATE INDEX idx_channel_targets_retry ON post_channel_targets(next_retry_at)
  WHERE status = 'failed' AND retry_count < 3;

-- Social Assets (media management)
CREATE TABLE social_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  asset_type social_asset_type NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  cdn_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds DECIMAL(10,2),
  status social_asset_status NOT NULL DEFAULT 'uploading',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_assets_user_id ON social_assets(user_id);
CREATE INDEX idx_social_assets_post_id ON social_assets(post_id);
CREATE INDEX idx_social_assets_status ON social_assets(status);

-- Social Events (webhook events & audit log)
CREATE TABLE social_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  channel_target_id UUID REFERENCES post_channel_targets(id) ON DELETE SET NULL,
  provider social_provider NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  provider_event_id VARCHAR(255),
  payload JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_events_account ON social_events(account_id);
CREATE INDEX idx_social_events_post ON social_events(post_id);
CREATE INDEX idx_social_events_provider ON social_events(provider);
CREATE INDEX idx_social_events_type ON social_events(event_type);
CREATE INDEX idx_social_events_created ON social_events(created_at);
CREATE INDEX idx_social_events_provider_event ON social_events(provider, provider_event_id);

-- Rate Limit Tracking
CREATE TABLE social_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  limit_max INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_account ON social_rate_limits(account_id);
CREATE INDEX idx_rate_limits_reset ON social_rate_limits(reset_at);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_channel_targets_updated_at
  BEFORE UPDATE ON post_channel_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_assets_updated_at
  BEFORE UPDATE ON social_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_channel_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_rate_limits ENABLE ROW LEVEL SECURITY;

-- OAuth States policies
CREATE POLICY "Users can manage own oauth_states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);

-- Social Accounts policies
CREATE POLICY "Users can manage own social_accounts" ON social_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Social Posts policies
CREATE POLICY "Users can manage own social_posts" ON social_posts
  FOR ALL USING (auth.uid() = user_id);

-- Post Channel Targets policies
CREATE POLICY "Users can manage post channel targets" ON post_channel_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM social_posts
      WHERE social_posts.id = post_id
      AND social_posts.user_id = auth.uid()
    )
  );

-- Social Assets policies
CREATE POLICY "Users can manage own social_assets" ON social_assets
  FOR ALL USING (auth.uid() = user_id);

-- Social Events policies
CREATE POLICY "Users can view own social_events" ON social_events
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM social_accounts
      WHERE social_accounts.id = account_id
      AND social_accounts.user_id = auth.uid()
    )
  );

-- Rate Limits policies
CREATE POLICY "Users can view own rate_limits" ON social_rate_limits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM social_accounts
      WHERE social_accounts.id = account_id
      AND social_accounts.user_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get post stats
CREATE OR REPLACE FUNCTION get_social_post_stats(p_post_id UUID)
RETURNS TABLE (
  total_channels BIGINT,
  published_count BIGINT,
  failed_count BIGINT,
  pending_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_channels,
    COUNT(*) FILTER (WHERE status = 'published')::BIGINT as published_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status IN ('draft', 'scheduled', 'publishing'))::BIGINT as pending_count
  FROM post_channel_targets
  WHERE post_id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get scheduled posts due for publishing
CREATE OR REPLACE FUNCTION get_due_scheduled_posts(p_limit INTEGER DEFAULT 50)
RETURNS SETOF social_posts AS $$
BEGIN
  RETURN QUERY
  SELECT sp.*
  FROM social_posts sp
  WHERE sp.status = 'scheduled'
    AND sp.scheduled_at <= NOW()
  ORDER BY sp.scheduled_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Get failed channel targets due for retry
CREATE OR REPLACE FUNCTION get_due_retry_targets(p_limit INTEGER DEFAULT 50)
RETURNS SETOF post_channel_targets AS $$
BEGIN
  RETURN QUERY
  SELECT pct.*
  FROM post_channel_targets pct
  WHERE pct.status = 'failed'
    AND pct.retry_count < 3
    AND pct.next_retry_at <= NOW()
  ORDER BY pct.next_retry_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_states
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE social_accounts IS 'Connected social media accounts (X, Instagram, YouTube, WhatsApp)';
COMMENT ON TABLE social_posts IS 'Posts to be published across multiple social channels';
COMMENT ON TABLE post_channel_targets IS 'Individual channel targets for each post with platform-specific config';
COMMENT ON TABLE social_assets IS 'Media assets (images, videos) attached to posts';
COMMENT ON TABLE social_events IS 'Webhook events and audit log for social media actions';

COMMENT ON COLUMN social_accounts.access_token_encrypted IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN social_accounts.refresh_token_encrypted IS 'AES-256-GCM encrypted refresh token (if available)';
COMMENT ON COLUMN social_accounts.token_iv IS 'Initialization vector for token decryption';

COMMENT ON COLUMN post_channel_targets.channel_config IS '
Platform-specific configuration:
- X: { thread_mode: boolean, reply_settings: string }
- Instagram: { location_id: string, user_tags: array, first_comment: string }
- YouTube: { title: string, description: string, privacy: string, playlist_id: string, tags: array }
- WhatsApp: { template_name: string, template_params: array, contact_ids: array }
';
