-- Campaign List Integration
-- Allows campaigns to target contacts based on static lists

-- Add list_id column to campaigns table (segment_id already exists from 20260129000000)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES lists(id) ON DELETE SET NULL;

-- Add specific_emails column if not exists
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS specific_emails TEXT[];

-- Create index for efficient list lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_list_id ON campaigns(list_id);

-- Comment for documentation
COMMENT ON COLUMN campaigns.list_id IS 'Optional static list to use as campaign recipients';
COMMENT ON COLUMN campaigns.specific_emails IS 'Optional array of specific email addresses to send to';
