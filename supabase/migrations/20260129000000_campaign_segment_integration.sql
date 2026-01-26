-- Campaign Segment Integration
-- Allows campaigns to target contacts based on dynamic segments

-- Add segment_id column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES segments(id) ON DELETE SET NULL;

-- Create index for efficient segment lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_segment_id ON campaigns(segment_id);

-- Comment for documentation
COMMENT ON COLUMN campaigns.segment_id IS 'Optional segment to filter campaign recipients dynamically';
