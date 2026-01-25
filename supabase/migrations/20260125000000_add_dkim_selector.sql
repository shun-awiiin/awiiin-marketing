-- DKIMセレクターカラムを追加
ALTER TABLE dns_verification 
ADD COLUMN IF NOT EXISTS dkim_selector VARCHAR(100);

-- コメント追加
COMMENT ON COLUMN dns_verification.dkim_selector IS 'Amazon SES等のDKIMセレクター名';

-- キャンペーンに specific_emails カラムを追加（特定のメールアドレスに直接送信用）
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS specific_emails TEXT[];

COMMENT ON COLUMN campaigns.specific_emails IS '特定のメールアドレスに直接送信する場合のメールアドレスリスト';
