-- Phase 2: Landing Pages Schema
-- AI-powered LP creation with block-based structure

-- Landing page status
CREATE TYPE landing_page_status AS ENUM ('draft', 'published', 'archived');

-- Landing Pages
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  status landing_page_status NOT NULL DEFAULT 'draft',
  blocks JSONB NOT NULL DEFAULT '[]', -- Array of block objects
  settings JSONB DEFAULT '{}', -- {seo_title, seo_description, og_image, favicon, custom_domain}
  custom_css TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Form Submissions (from LP forms)
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  form_data JSONB NOT NULL,
  utm_params JSONB DEFAULT '{}',
  referrer_code VARCHAR(50),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Generation History (for tracking AI-generated content)
CREATE TABLE IF NOT EXISTS lp_generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  generated_blocks JSONB NOT NULL,
  model VARCHAR(50) DEFAULT 'claude-3-sonnet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LP Templates (pre-made templates)
CREATE TABLE IF NOT EXISTS lp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'sales', 'opt-in', 'webinar', 'product', etc.
  thumbnail_url TEXT,
  blocks JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update funnel_steps to reference landing_pages
ALTER TABLE funnel_steps
  ADD CONSTRAINT fk_funnel_steps_page
  FOREIGN KEY (page_id) REFERENCES landing_pages(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_landing_pages_user_id ON landing_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);
CREATE INDEX IF NOT EXISTS idx_landing_pages_funnel_id ON landing_pages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_landing_page_id ON form_submissions(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_lp_generation_history_user_id ON lp_generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_lp_templates_category ON lp_templates(category);
CREATE INDEX IF NOT EXISTS idx_lp_templates_is_public ON lp_templates(is_public);

-- RLS Policies
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_templates ENABLE ROW LEVEL SECURITY;

-- Landing pages policies
CREATE POLICY "Users can view own landing pages" ON landing_pages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own landing pages" ON landing_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own landing pages" ON landing_pages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own landing pages" ON landing_pages
  FOR DELETE USING (auth.uid() = user_id);

-- Public access for published pages (for public rendering)
CREATE POLICY "Anyone can view published pages by slug" ON landing_pages
  FOR SELECT USING (status = 'published');

-- Form submissions policies
CREATE POLICY "Users can view own form submissions" ON form_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert form submissions" ON form_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM landing_pages WHERE landing_pages.id = form_submissions.landing_page_id)
  );

-- Service role can insert form submissions
CREATE POLICY "Service role can manage form submissions" ON form_submissions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Generation history policies
CREATE POLICY "Users can view own generation history" ON lp_generation_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generation history" ON lp_generation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Templates policies
CREATE POLICY "Users can view public templates" ON lp_templates
  FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON lp_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON lp_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON lp_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Function to increment template use count
CREATE OR REPLACE FUNCTION increment_template_use_count(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE lp_templates
  SET use_count = use_count + 1,
      updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create contact from form submission
CREATE OR REPLACE FUNCTION create_contact_from_form_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_first_name TEXT;
  v_contact_id UUID;
  v_lp_user_id UUID;
BEGIN
  -- Get email and name from form_data
  v_email := NEW.form_data->>'email';
  v_first_name := COALESCE(NEW.form_data->>'name', NEW.form_data->>'first_name');

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the user_id from the landing page
  SELECT user_id INTO v_lp_user_id
  FROM landing_pages
  WHERE id = NEW.landing_page_id;

  -- Check if contact already exists
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE user_id = v_lp_user_id AND email = v_email;

  IF v_contact_id IS NULL THEN
    -- Create new contact
    INSERT INTO contacts (user_id, email, first_name, status)
    VALUES (v_lp_user_id, v_email, v_first_name, 'active')
    RETURNING id INTO v_contact_id;
  END IF;

  -- Update the form submission with contact_id
  NEW.contact_id := v_contact_id;
  NEW.user_id := v_lp_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating contacts
CREATE TRIGGER trg_create_contact_from_form
  BEFORE INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION create_contact_from_form_submission();
