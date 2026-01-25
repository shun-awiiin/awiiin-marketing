-- DKIMセレクターカラムを追加
ALTER TABLE dns_verification 
ADD COLUMN IF NOT EXISTS dkim_selector VARCHAR(100);

-- コメント追加
COMMENT ON COLUMN dns_verification.dkim_selector IS 'Amazon SES等のDKIMセレクター名';
