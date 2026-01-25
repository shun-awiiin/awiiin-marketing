-- Phase 5: Member Site Schema
-- Video content delivery with Bunny Stream integration

-- Course status
CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE enrollment_access AS ENUM ('active', 'expired', 'suspended');
CREATE TYPE lesson_type AS ENUM ('video', 'text', 'quiz', 'download');

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- Linked product for purchase
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status course_status NOT NULL DEFAULT 'draft',
  settings JSONB DEFAULT '{}', -- {drip_enabled, drip_interval_days, allow_preview}
  module_count INTEGER DEFAULT 0,
  lesson_count INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  enrolled_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Modules (chapters)
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  module_order INTEGER NOT NULL,
  lesson_count INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE, -- Denormalized for queries
  title VARCHAR(255) NOT NULL,
  description TEXT,
  lesson_type lesson_type NOT NULL DEFAULT 'video',
  lesson_order INTEGER NOT NULL,
  -- Video fields (Bunny Stream)
  bunny_video_id VARCHAR(255),
  bunny_library_id VARCHAR(255),
  video_url TEXT, -- Fallback URL
  thumbnail_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  -- Text/download fields
  content TEXT, -- Rich text content for text lessons
  download_url TEXT, -- For download type
  download_name VARCHAR(255),
  is_preview BOOLEAN DEFAULT FALSE, -- Free preview
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course Enrollments
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Store owner
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  access_status enrollment_access NOT NULL DEFAULT 'active',
  progress_percent INTEGER DEFAULT 0,
  completed_lessons INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = lifetime
  last_accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(course_id, customer_id)
);

-- Lesson Progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  watch_seconds INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(enrollment_id, lesson_id)
);

-- Video Tokens Cache (for Bunny Stream)
CREATE TABLE IF NOT EXISTS video_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  signed_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course Resources (supplementary materials)
CREATE TABLE IF NOT EXISTS course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE, -- Optional, can be course-level
  title VARCHAR(255) NOT NULL,
  description TEXT,
  resource_type VARCHAR(50) NOT NULL, -- 'pdf', 'doc', 'zip', 'link', etc.
  url TEXT NOT NULL,
  file_size INTEGER, -- In bytes
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_product_id ON courses(product_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_order ON modules(course_id, module_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(module_id, lesson_order);
CREATE INDEX IF NOT EXISTS idx_lessons_bunny_video_id ON lessons(bunny_video_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_customer_id ON course_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_access_status ON course_enrollments(access_status);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_enrollment_id ON lesson_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_tokens_lesson_customer ON video_tokens(lesson_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_video_tokens_expires_at ON video_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_course_resources_course_id ON course_resources(course_id);

-- RLS Policies
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY;

-- Courses policies
CREATE POLICY "Users can view own courses" ON courses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own courses" ON courses
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Published courses are viewable" ON courses
  FOR SELECT USING (status = 'published');

-- Modules policies
CREATE POLICY "Users can view modules of own courses" ON modules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = modules.course_id AND courses.user_id = auth.uid())
  );
CREATE POLICY "Users can manage modules of own courses" ON modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = modules.course_id AND courses.user_id = auth.uid())
  );
CREATE POLICY "Enrolled users can view modules" ON modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      JOIN customers c ON ce.customer_id = c.id
      WHERE ce.course_id = modules.course_id
      AND ce.access_status = 'active'
    )
  );

-- Lessons policies
CREATE POLICY "Users can view lessons of own courses" ON lessons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.user_id = auth.uid())
  );
CREATE POLICY "Users can manage lessons of own courses" ON lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.user_id = auth.uid())
  );
CREATE POLICY "Enrolled users can view lessons" ON lessons
  FOR SELECT USING (
    is_preview = TRUE OR
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      JOIN customers c ON ce.customer_id = c.id
      WHERE ce.course_id = lessons.course_id
      AND ce.access_status = 'active'
    )
  );

-- Enrollments policies
CREATE POLICY "Users can view own enrollments" ON course_enrollments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own enrollments" ON course_enrollments
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage enrollments" ON course_enrollments
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Progress policies
CREATE POLICY "Users can view progress of own courses" ON lesson_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.id = lesson_progress.enrollment_id
      AND ce.user_id = auth.uid()
    )
  );
CREATE POLICY "Enrolled users can update own progress" ON lesson_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.id = lesson_progress.enrollment_id
    )
  );
CREATE POLICY "Service role can manage progress" ON lesson_progress
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Video tokens policies
CREATE POLICY "Service role can manage video tokens" ON video_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Resources policies
CREATE POLICY "Users can view resources of own courses" ON course_resources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = course_resources.course_id AND courses.user_id = auth.uid())
  );
CREATE POLICY "Users can manage resources of own courses" ON course_resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = course_resources.course_id AND courses.user_id = auth.uid())
  );
CREATE POLICY "Enrolled users can view resources" ON course_resources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.course_id = course_resources.course_id
      AND ce.access_status = 'active'
    )
  );

-- Function to update course counts when module is added/removed
CREATE OR REPLACE FUNCTION update_course_module_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE courses
    SET module_count = module_count + 1, updated_at = NOW()
    WHERE id = NEW.course_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE courses
    SET module_count = module_count - 1, updated_at = NOW()
    WHERE id = OLD.course_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_course_module_count
  AFTER INSERT OR DELETE ON modules
  FOR EACH ROW
  EXECUTE FUNCTION update_course_module_count();

-- Function to update module/course counts when lesson is added/removed
CREATE OR REPLACE FUNCTION update_lesson_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE modules
    SET lesson_count = lesson_count + 1,
        total_duration_seconds = total_duration_seconds + COALESCE(NEW.duration_seconds, 0),
        updated_at = NOW()
    WHERE id = NEW.module_id;

    UPDATE courses
    SET lesson_count = lesson_count + 1,
        total_duration_seconds = total_duration_seconds + COALESCE(NEW.duration_seconds, 0),
        updated_at = NOW()
    WHERE id = NEW.course_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE modules
    SET lesson_count = lesson_count - 1,
        total_duration_seconds = total_duration_seconds - COALESCE(OLD.duration_seconds, 0),
        updated_at = NOW()
    WHERE id = OLD.module_id;

    UPDATE courses
    SET lesson_count = lesson_count - 1,
        total_duration_seconds = total_duration_seconds - COALESCE(OLD.duration_seconds, 0),
        updated_at = NOW()
    WHERE id = OLD.course_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update duration if changed
    IF OLD.duration_seconds IS DISTINCT FROM NEW.duration_seconds THEN
      UPDATE modules
      SET total_duration_seconds = total_duration_seconds - COALESCE(OLD.duration_seconds, 0) + COALESCE(NEW.duration_seconds, 0),
          updated_at = NOW()
      WHERE id = NEW.module_id;

      UPDATE courses
      SET total_duration_seconds = total_duration_seconds - COALESCE(OLD.duration_seconds, 0) + COALESCE(NEW.duration_seconds, 0),
          updated_at = NOW()
      WHERE id = NEW.course_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_lesson_counts
  AFTER INSERT OR DELETE OR UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_counts();

-- Function to update enrollment progress when lesson is completed
CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment course_enrollments%ROWTYPE;
  v_total_lessons INTEGER;
  v_completed_lessons INTEGER;
  v_progress_percent INTEGER;
BEGIN
  -- Get enrollment
  SELECT * INTO v_enrollment FROM course_enrollments WHERE id = NEW.enrollment_id;

  IF v_enrollment IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total and completed lessons
  SELECT COUNT(*) INTO v_total_lessons
  FROM lessons
  WHERE course_id = v_enrollment.course_id AND is_published = TRUE;

  SELECT COUNT(*) INTO v_completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  WHERE lp.enrollment_id = NEW.enrollment_id AND lp.is_completed = TRUE;

  -- Calculate progress
  IF v_total_lessons > 0 THEN
    v_progress_percent := (v_completed_lessons * 100) / v_total_lessons;
  ELSE
    v_progress_percent := 0;
  END IF;

  -- Update enrollment
  UPDATE course_enrollments
  SET
    progress_percent = v_progress_percent,
    completed_lessons = v_completed_lessons,
    last_accessed_at = NOW(),
    completed_at = CASE
      WHEN v_progress_percent = 100 AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END,
    updated_at = NOW()
  WHERE id = NEW.enrollment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_enrollment_progress
  AFTER INSERT OR UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_enrollment_progress();

-- Function to create enrollment when purchase is completed
CREATE OR REPLACE FUNCTION create_enrollment_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_course courses%ROWTYPE;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Find course linked to the product
    SELECT * INTO v_course
    FROM courses
    WHERE product_id = NEW.product_id AND status = 'published';

    IF v_course IS NOT NULL THEN
      -- Create enrollment if not exists
      INSERT INTO course_enrollments (user_id, course_id, customer_id, purchase_id)
      VALUES (NEW.user_id, v_course.id, NEW.customer_id, NEW.id)
      ON CONFLICT (course_id, customer_id) DO UPDATE
      SET access_status = 'active', updated_at = NOW();

      -- Update course enrolled count
      UPDATE courses
      SET enrolled_count = enrolled_count + 1, updated_at = NOW()
      WHERE id = v_course.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_enrollment_on_purchase
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION create_enrollment_on_purchase();

-- Clean up expired video tokens (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_video_tokens()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM video_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
