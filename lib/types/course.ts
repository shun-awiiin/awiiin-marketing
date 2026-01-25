import { z } from 'zod'

// Course Status
export const CourseStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus]

export const EnrollmentAccess = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
} as const
export type EnrollmentAccess = (typeof EnrollmentAccess)[keyof typeof EnrollmentAccess]

export const LessonType = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
  DOWNLOAD: 'download',
} as const
export type LessonType = (typeof LessonType)[keyof typeof LessonType]

// Course
export interface Course {
  id: string
  user_id: string
  product_id: string | null
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  status: CourseStatus
  settings: {
    drip_enabled?: boolean
    drip_interval_days?: number
    allow_preview?: boolean
  }
  module_count: number
  lesson_count: number
  total_duration_seconds: number
  enrolled_count: number
  created_at: string
  updated_at: string
}

// Module
export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  module_order: number
  lesson_count: number
  total_duration_seconds: number
  created_at: string
  updated_at: string
}

// Lesson
export interface Lesson {
  id: string
  module_id: string
  course_id: string
  title: string
  description: string | null
  lesson_type: LessonType
  lesson_order: number
  bunny_video_id: string | null
  bunny_library_id: string | null
  video_url: string | null
  thumbnail_url: string | null
  duration_seconds: number
  content: string | null
  download_url: string | null
  download_name: string | null
  is_preview: boolean
  is_published: boolean
  created_at: string
  updated_at: string
}

// Course Enrollment
export interface CourseEnrollment {
  id: string
  user_id: string
  course_id: string
  customer_id: string
  purchase_id: string | null
  access_status: EnrollmentAccess
  progress_percent: number
  completed_lessons: number
  enrolled_at: string
  expires_at: string | null
  last_accessed_at: string | null
  completed_at: string | null
}

// Lesson Progress
export interface LessonProgress {
  id: string
  enrollment_id: string
  lesson_id: string
  watch_seconds: number
  is_completed: boolean
  completed_at: string | null
  last_position_seconds: number
  started_at: string
  updated_at: string
}

// Course Resource
export interface CourseResource {
  id: string
  course_id: string
  lesson_id: string | null
  title: string
  description: string | null
  resource_type: string
  url: string
  file_size: number | null
  download_count: number
  created_at: string
}

// Video Token (for Bunny Stream)
export interface VideoToken {
  id: string
  lesson_id: string
  customer_id: string
  token: string
  signed_url: string
  expires_at: string
  created_at: string
}

// Zod Schemas
export const createCourseSchema = z.object({
  title: z.string().min(1, 'コースタイトルは必須です').max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
  product_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  settings: z.object({
    drip_enabled: z.boolean().optional(),
    drip_interval_days: z.number().int().positive().optional(),
    allow_preview: z.boolean().optional(),
  }).optional(),
})

export const updateCourseSchema = createCourseSchema.partial()

export const createModuleSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1, 'モジュールタイトルは必須です').max(255),
  description: z.string().optional(),
  module_order: z.number().int().min(0),
})

export const updateModuleSchema = createModuleSchema.partial().omit({ course_id: true })

export const createLessonSchema = z.object({
  module_id: z.string().uuid(),
  title: z.string().min(1, 'レッスンタイトルは必須です').max(255),
  description: z.string().optional(),
  lesson_type: z.enum(['video', 'text', 'quiz', 'download']).default('video'),
  lesson_order: z.number().int().min(0),
  bunny_video_id: z.string().optional(),
  bunny_library_id: z.string().optional(),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  duration_seconds: z.number().int().min(0).optional(),
  content: z.string().optional(),
  download_url: z.string().url().optional(),
  download_name: z.string().optional(),
  is_preview: z.boolean().optional().default(false),
  is_published: z.boolean().optional().default(true),
})

export const updateLessonSchema = createLessonSchema.partial().omit({ module_id: true })

export const updateProgressSchema = z.object({
  lesson_id: z.string().uuid(),
  watch_seconds: z.number().int().min(0).optional(),
  last_position_seconds: z.number().int().min(0).optional(),
  is_completed: z.boolean().optional(),
})

export const createResourceSchema = z.object({
  course_id: z.string().uuid(),
  lesson_id: z.string().uuid().optional(),
  title: z.string().min(1, 'リソースタイトルは必須です').max(255),
  description: z.string().optional(),
  resource_type: z.string().min(1),
  url: z.string().url(),
  file_size: z.number().int().min(0).optional(),
})

// API Response Types
export interface CourseWithModules extends Course {
  modules: ModuleWithLessons[]
}

export interface ModuleWithLessons extends Module {
  lessons: Lesson[]
}

export interface LessonWithProgress extends Lesson {
  progress?: LessonProgress
}

export interface EnrollmentWithProgress extends CourseEnrollment {
  course?: Course
  lesson_progress?: LessonProgress[]
}

// Member Area Types
export interface MemberCourseData {
  enrollment: CourseEnrollment
  course: CourseWithModules
  current_lesson?: Lesson
  next_lesson?: Lesson
  progress_by_lesson: Record<string, LessonProgress>
}

export interface VideoPlaybackData {
  lesson: Lesson
  signed_url: string
  expires_at: string
  last_position: number
}

// Bunny Stream Types
export interface BunnyVideoUploadResponse {
  video_id: string
  upload_url: string
}

export interface BunnyVideoStatus {
  video_id: string
  status: 'processing' | 'ready' | 'failed'
  thumbnail_url?: string
  duration_seconds?: number
}

// Course Analytics
export interface CourseAnalytics {
  total_enrollments: number
  active_enrollments: number
  completed_enrollments: number
  average_progress: number
  completion_rate: number
  lessons_by_completion: Array<{
    lesson: Lesson
    completion_count: number
    completion_rate: number
  }>
  enrollments_by_date: Array<{
    date: string
    count: number
  }>
}
