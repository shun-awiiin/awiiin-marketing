-- Organizations - Multi-tenant support
-- Version: 1.0.0
-- Date: 2026-01-31

-- ============================================
-- TABLES
-- ============================================

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization members with roles
CREATE TYPE org_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ============================================
-- ADD organization_id TO DATA TABLES
-- ============================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE standalone_forms ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE chat_widgets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE calendar_connections ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_lists_org ON lists(organization_id);
CREATE INDEX idx_standalone_forms_org ON standalone_forms(organization_id);
CREATE INDEX idx_chat_widgets_org ON chat_widgets(organization_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Users can see orgs they belong to
CREATE POLICY "org_select_member" ON organizations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "org_insert" ON organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "org_update_admin" ON organizations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "org_delete_owner" ON organizations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = id AND user_id = auth.uid() AND role = 'owner'
  ));

-- Members can see memberships in their own orgs
CREATE POLICY "org_members_select" ON organization_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id AND om.user_id = auth.uid()
  ));

-- Only owner/admin can manage members
CREATE POLICY "org_members_insert" ON organization_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

CREATE POLICY "org_members_update" ON organization_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

CREATE POLICY "org_members_delete" ON organization_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  ));

-- Service role bypass
CREATE POLICY "org_service_role" ON organizations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "org_members_service_role" ON organization_members FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- AUTO-CREATE DEFAULT ORG ON USER SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION create_default_organization()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  INSERT INTO organizations (name, slug, created_by)
  VALUES (
    COALESCE(NEW.display_name, split_part(NEW.email, '@', 1)) || ' の組織',
    NEW.id::TEXT,
    NEW.id
  ) RETURNING id INTO v_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_default_org
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_organization();
