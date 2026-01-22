-- ドメイン送信統計テーブル（初回制限管理用）
CREATE TABLE IF NOT EXISTS domain_send_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    first_send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_domain_send_stats_user_id ON domain_send_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_send_stats_domain ON domain_send_stats(domain);

-- RLS
ALTER TABLE domain_send_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own domain_send_stats" ON domain_send_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own domain_send_stats" ON domain_send_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- DNS検証結果テーブル
CREATE TABLE IF NOT EXISTS dns_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    spf_valid BOOLEAN DEFAULT FALSE,
    dkim_valid BOOLEAN DEFAULT FALSE,
    dmarc_valid BOOLEAN DEFAULT FALSE,
    dmarc_policy VARCHAR(20), -- 'none', 'quarantine', 'reject'
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_dns_verification_user_id ON dns_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_dns_verification_domain ON dns_verification(domain);

-- RLS
ALTER TABLE dns_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dns_verification" ON dns_verification
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dns_verification" ON dns_verification
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dns_verification" ON dns_verification
    FOR UPDATE USING (auth.uid() = user_id);

-- auto update trigger
CREATE TRIGGER update_dns_verification_updated_at
    BEFORE UPDATE ON dns_verification
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
