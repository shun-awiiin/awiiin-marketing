-- Static Lists Schema
-- Enables users to manually curate contact groups

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280',
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- List-Contact junction table
CREATE TABLE IF NOT EXISTS list_contacts (
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_contacts_contact_id ON list_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_list_contacts_list_id ON list_contacts(list_id);

-- Trigger for updated_at
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lists" ON lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lists" ON lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists" ON lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists" ON lists
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE list_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own list_contacts" ON list_contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own list_contacts" ON list_contacts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own list_contacts" ON list_contacts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid())
  );

-- Function to update list contact count
CREATE OR REPLACE FUNCTION update_list_contact_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE lists SET contact_count = contact_count + 1 WHERE id = NEW.list_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE lists SET contact_count = contact_count - 1 WHERE id = OLD.list_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update contact count
CREATE TRIGGER update_list_contact_count_trigger
  AFTER INSERT OR DELETE ON list_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_list_contact_count();
