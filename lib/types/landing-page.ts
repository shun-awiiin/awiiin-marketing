import { z } from 'zod'

// LP Status
export const LandingPageStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const
export type LandingPageStatus = (typeof LandingPageStatus)[keyof typeof LandingPageStatus]

// Block Types
export const BlockType = {
  HERO: 'hero',
  PROBLEM: 'problem',
  SOLUTION: 'solution',
  FEATURES: 'features',
  TESTIMONIALS: 'testimonials',
  PRICING: 'pricing',
  BONUS: 'bonus',
  FAQ: 'faq',
  CTA: 'cta',
  FORM: 'form',
  VIDEO: 'video',
  COUNTDOWN: 'countdown',
} as const
export type BlockType = (typeof BlockType)[keyof typeof BlockType]

// Block Content Types
export interface HeroContent {
  headline: string
  subheadline?: string
  cta_text?: string
  cta_url?: string
  background_image?: string
  background_color?: string
}

export interface ProblemContent {
  title: string
  problems: string[]
  icon?: string
}

export interface SolutionContent {
  title: string
  description: string
  image?: string
  bullets?: string[]
}

export interface FeatureItem {
  icon?: string
  title: string
  description: string
}

export interface FeaturesContent {
  title: string
  subtitle?: string
  features: FeatureItem[]
  columns?: 2 | 3 | 4
}

export interface TestimonialItem {
  name: string
  role?: string
  image?: string
  quote: string
  rating?: number
}

export interface TestimonialsContent {
  title: string
  items: TestimonialItem[]
}

export interface PricingPlan {
  name: string
  price: string
  original_price?: string
  period?: string
  features: string[]
  cta_text: string
  cta_url: string
  is_popular?: boolean
}

export interface PricingContent {
  title: string
  subtitle?: string
  plans: PricingPlan[]
}

export interface BonusItem {
  title: string
  value?: string
  description: string
  image?: string
}

export interface BonusContent {
  title: string
  subtitle?: string
  bonuses: BonusItem[]
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqContent {
  title: string
  items: FaqItem[]
}

export interface CtaContent {
  title: string
  description?: string
  button_text: string
  button_url: string
  urgency_text?: string
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox'
  placeholder?: string
  required: boolean
  options?: string[] // For select
}

export interface FormContent {
  title: string
  subtitle?: string
  fields: FormField[]
  submit_text: string
  success_message?: string
  redirect_url?: string
}

export interface VideoContent {
  title?: string
  youtube_url: string
  description?: string
  autoplay?: boolean
}

export interface CountdownContent {
  title: string
  end_date: string // ISO string
  expired_text: string
  show_days?: boolean
  redirect_url_on_expired?: string
}

// Block Settings
export interface BlockSettings {
  background_color?: string
  text_color?: string
  padding?: 'small' | 'medium' | 'large'
  width?: 'narrow' | 'medium' | 'full'
  hidden?: boolean
}

// Block Union Type
export type BlockContent =
  | HeroContent
  | ProblemContent
  | SolutionContent
  | FeaturesContent
  | TestimonialsContent
  | PricingContent
  | BonusContent
  | FaqContent
  | CtaContent
  | FormContent
  | VideoContent
  | CountdownContent

// LP Block
export interface LPBlock {
  id: string
  type: BlockType
  content: BlockContent
  settings: BlockSettings
}

// LP Settings
export interface LPSettings {
  seo_title?: string
  seo_description?: string
  og_image?: string
  favicon?: string
  custom_domain?: string
  tracking_enabled?: boolean
  funnel_id?: string
}

// Landing Page
export interface LandingPage {
  id: string
  user_id: string
  funnel_id: string | null
  title: string
  slug: string
  status: LandingPageStatus
  blocks: LPBlock[]
  settings: LPSettings
  custom_css: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

// Form Submission
export interface FormSubmission {
  id: string
  user_id: string
  landing_page_id: string
  visitor_id: string | null
  contact_id: string | null
  form_data: Record<string, string>
  utm_params: Record<string, string>
  referrer_code: string | null
  submitted_at: string
}

// LP Template
export interface LPTemplate {
  id: string
  user_id: string | null
  name: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  blocks: LPBlock[]
  is_public: boolean
  use_count: number
  created_at: string
  updated_at: string
}

// Zod Schemas for Validation
export const blockSettingsSchema = z.object({
  background_color: z.string().optional(),
  text_color: z.string().optional(),
  padding: z.enum(['small', 'medium', 'large']).optional(),
  width: z.enum(['narrow', 'medium', 'full']).optional(),
  hidden: z.boolean().optional(),
})

export const lpBlockSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['hero', 'problem', 'solution', 'features', 'testimonials', 'pricing', 'bonus', 'faq', 'cta', 'form', 'video', 'countdown']),
  content: z.record(z.unknown()),
  settings: blockSettingsSchema,
})

export const createLandingPageSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'スラグは英小文字、数字、ハイフンのみ使用できます'),
  funnel_id: z.string().uuid().optional(),
  blocks: z.array(lpBlockSchema).optional().default([]),
  settings: z.record(z.unknown()).optional().default({}),
  custom_css: z.string().optional(),
})

export const updateLandingPageSchema = createLandingPageSchema.partial()

export const submitFormSchema = z.object({
  landing_page_id: z.string().uuid(),
  form_data: z.record(z.string()),
  utm_params: z.record(z.string()).optional(),
  referrer_code: z.string().max(50).optional(),
})

// AI Generation Types
export interface LPGenerationInput {
  product_name: string
  target_audience: string
  main_problem: string
  solution: string
  price?: string
  bonuses?: string[]
  urgency?: string
  testimonials?: Array<{
    name: string
    quote: string
  }>
}

export interface LPGenerationResult {
  blocks: LPBlock[]
  prompt_used: string
}

// API Response Types
export interface LandingPageWithStats extends LandingPage {
  form_submissions_count?: number
  conversion_rate?: number
}
