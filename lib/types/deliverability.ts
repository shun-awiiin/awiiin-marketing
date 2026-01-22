/**
 * Deliverability Types for Email Tool
 * Types for email validation, domain health, engagement tracking,
 * reputation management, and content analysis
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export type EmailRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type EngagementLevel =
  | 'highly_engaged'
  | 'engaged'
  | 'neutral'
  | 'disengaged'
  | 'inactive';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AuthStatus = 'pass' | 'fail' | 'partial' | 'unknown';

export type ContentCheckCategory =
  | 'spam_words'
  | 'links'
  | 'html_ratio'
  | 'subject'
  | 'images';

// ============================================
// EMAIL VALIDATION
// ============================================

export interface EmailValidationResult {
  id?: string;
  email: string;
  syntax_valid: boolean;
  mx_valid: boolean | null;
  mx_records: string[];
  is_disposable: boolean;
  is_role_based: boolean;
  is_free_provider: boolean;
  risk_level: EmailRiskLevel;
  risk_score: number;
  validation_details: {
    syntax_errors?: string[];
    mx_lookup_error?: string;
    detected_issues?: string[];
  };
  validated_at: string;
}

export interface BatchValidationRequest {
  emails: string[];
  skip_mx_check?: boolean;
}

export interface BatchValidationResult {
  total: number;
  valid: number;
  invalid: number;
  results: EmailValidationResult[];
  summary: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
    critical_risk: number;
  };
}

// ============================================
// DOMAIN HEALTH
// ============================================

export interface DomainHealthRecord {
  id: string;
  user_id: string;
  domain: string;
  spf_status: AuthStatus;
  spf_record: string | null;
  dkim_status: AuthStatus;
  dkim_selector: string | null;
  dkim_record: string | null;
  dmarc_status: AuthStatus;
  dmarc_record: string | null;
  dmarc_policy: string | null;
  health_score: number;
  recommendations: DomainRecommendation[];
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

export interface DomainRecommendation {
  category: 'spf' | 'dkim' | 'dmarc' | 'general';
  severity: AlertSeverity;
  title: string;
  description: string;
  action?: string;
}

export interface DomainHealthCheckRequest {
  domain: string;
  dkim_selector?: string;
}

export interface DomainHealthCheckResult {
  domain: string;
  spf: {
    status: AuthStatus;
    record: string | null;
    details: string[];
  };
  dkim: {
    status: AuthStatus;
    selector: string | null;
    record: string | null;
    details: string[];
  };
  dmarc: {
    status: AuthStatus;
    record: string | null;
    policy: string | null;
    details: string[];
  };
  health_score: number;
  recommendations: DomainRecommendation[];
}

// ============================================
// ENGAGEMENT TRACKING
// ============================================

export interface ContactEngagement {
  contact_id: string;
  email: string;
  first_name: string | null;
  engagement_score: number;
  engagement_level: EngagementLevel;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  open_rate: number;
  click_rate: number;
  last_open_at: string | null;
  last_click_at: string | null;
  last_sent_at: string | null;
}

export interface EngagementSummary {
  total_contacts: number;
  distribution: {
    highly_engaged: number;
    engaged: number;
    neutral: number;
    disengaged: number;
    inactive: number;
  };
  average_score: number;
  average_open_rate: number;
  average_click_rate: number;
}

export interface EngagementUpdateEvent {
  contact_id: string;
  event_type: 'open' | 'click';
  message_id: string;
  campaign_id: string;
  occurred_at: string;
}

// ============================================
// LIST HYGIENE
// ============================================

export interface ListHygieneStatus {
  total_contacts: number;
  active_contacts: number;
  bounced_contacts: number;
  complained_contacts: number;
  unsubscribed_contacts: number;
  high_risk_contacts: number;
  inactive_contacts: number;
  health_percentage: number;
  recommendations: ListHygieneRecommendation[];
}

export interface ListHygieneRecommendation {
  type: 'suppress' | 'revalidate' | 'reengage' | 'clean';
  contact_count: number;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SuppressRequest {
  criteria: {
    risk_level?: EmailRiskLevel[];
    engagement_level?: EngagementLevel[];
    inactive_days?: number;
    bounced?: boolean;
    complained?: boolean;
  };
  dry_run?: boolean;
}

export interface SuppressResult {
  suppressed_count: number;
  contacts: Array<{
    id: string;
    email: string;
    reason: string;
  }>;
}

// ============================================
// REPUTATION
// ============================================

export interface ReputationMetrics {
  id: string;
  user_id: string;
  domain: string;
  date: string;
  total_sent: number;
  total_delivered: number;
  total_bounced: number;
  total_complained: number;
  total_opened: number;
  total_clicked: number;
  delivery_rate: number;
  bounce_rate: number;
  complaint_rate: number;
  open_rate: number;
  click_rate: number;
}

export interface ReputationSummary {
  domain: string;
  period: '7d' | '30d' | '90d';
  total_sent: number;
  avg_delivery_rate: number;
  avg_bounce_rate: number;
  avg_complaint_rate: number;
  avg_open_rate: number;
  avg_click_rate: number;
  trend: {
    delivery_rate: 'up' | 'down' | 'stable';
    bounce_rate: 'up' | 'down' | 'stable';
    complaint_rate: 'up' | 'down' | 'stable';
  };
  risk_level: 'healthy' | 'warning' | 'critical';
  daily_metrics: ReputationMetrics[];
}

// ============================================
// DOMAIN WARMUP
// ============================================

export interface DomainWarmup {
  id: string;
  user_id: string;
  domain: string;
  started_at: string;
  current_day: number;
  current_daily_limit: number;
  target_daily_limit: number;
  warmup_schedule: WarmupDay[];
  is_active: boolean;
  completed_at: string | null;
}

export interface WarmupDay {
  day: number;
  limit: number;
  sent?: number;
  date?: string;
}

export interface WarmupProgress {
  domain: string;
  current_day: number;
  total_days: number;
  progress_percentage: number;
  today_limit: number;
  today_sent: number;
  remaining_today: number;
  on_track: boolean;
  estimated_completion: string;
}

// ============================================
// CONTENT CHECK
// ============================================

export interface ContentCheckRequest {
  subject: string;
  body_text: string;
  body_html?: string;
  from_email?: string;
}

export interface ContentCheckResult {
  id?: string;
  overall_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  spam_score: number;
  spam_words_found: SpamWordMatch[];
  links_found: LinkCheckResult[];
  links_valid: boolean;
  html_text_ratio: number | null;
  subject_score: number;
  subject_analysis: SubjectAnalysis;
  recommendations: ContentRecommendation[];
}

export interface SpamWordMatch {
  word: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  context: string;
}

export interface LinkCheckResult {
  url: string;
  is_valid: boolean;
  is_shortened: boolean;
  is_tracking: boolean;
  domain: string;
  error?: string;
}

export interface SubjectAnalysis {
  length: number;
  has_personalization: boolean;
  has_spam_triggers: boolean;
  capitalization_ratio: number;
  special_char_ratio: number;
  recommendations: string[];
}

export interface ContentRecommendation {
  category: ContentCheckCategory;
  severity: AlertSeverity;
  message: string;
  suggestion?: string;
}

// ============================================
// DELIVERABILITY SCORE
// ============================================

export interface DeliverabilityScore {
  overall_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: {
    domain_health: FactorScore;
    list_quality: FactorScore;
    engagement: FactorScore;
    reputation: FactorScore;
    content: FactorScore;
  };
  recommendations: PrioritizedRecommendation[];
  last_updated: string;
}

export interface FactorScore {
  score: number;
  weight: number;
  weighted_score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  details: string[];
}

export interface PrioritizedRecommendation {
  priority: 1 | 2 | 3;
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  action_url?: string;
}

// ============================================
// ALERTS
// ============================================

export interface DeliverabilityAlert {
  id: string;
  user_id: string;
  severity: AlertSeverity;
  category: string;
  title: string;
  message: string;
  action_url: string | null;
  action_label: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  expires_at: string | null;
  created_at: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface DeliverabilityDashboardData {
  score: DeliverabilityScore;
  domain_health: DomainHealthRecord[];
  list_hygiene: ListHygieneStatus;
  reputation: ReputationSummary;
  warmup: WarmupProgress | null;
  alerts: DeliverabilityAlert[];
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const EmailValidationRequestSchema = z.object({
  email: z.string().email(),
  skip_mx_check: z.boolean().optional().default(false),
});

export const BatchValidationRequestSchema = z.object({
  emails: z.array(z.string()).min(1).max(1000),
  skip_mx_check: z.boolean().optional().default(false),
});

export const DomainHealthCheckRequestSchema = z.object({
  domain: z.string().min(1).max(255),
  dkim_selector: z.string().optional(),
});

export const ContentCheckRequestSchema = z.object({
  subject: z.string().min(1).max(200),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
  from_email: z.string().email().optional(),
});

export const SuppressRequestSchema = z.object({
  criteria: z.object({
    risk_level: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
    engagement_level: z.array(z.enum(['highly_engaged', 'engaged', 'neutral', 'disengaged', 'inactive'])).optional(),
    inactive_days: z.number().int().positive().optional(),
    bounced: z.boolean().optional(),
    complained: z.boolean().optional(),
  }),
  dry_run: z.boolean().optional().default(true),
});

// ============================================
// CONSTANTS
// ============================================

export const SPAM_WORD_CATEGORIES = {
  urgency: ['urgent', 'act now', 'limited time', 'expires', 'hurry', 'immediate', 'instant'],
  money: ['free', 'cash', 'bonus', 'winner', 'prize', 'lottery', 'million', 'earn money'],
  pressure: ['guaranteed', 'no obligation', 'risk free', 'satisfaction guaranteed'],
  suspicious: ['click here', 'click below', 'unsubscribe', 'remove', 'opt out'],
} as const;

export const ROLE_BASED_PREFIXES = [
  'info', 'support', 'sales', 'admin', 'contact', 'help', 'hello',
  'noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'webmaster',
  'marketing', 'billing', 'feedback', 'abuse', 'security', 'team',
  'office', 'hr', 'jobs', 'careers', 'newsletter', 'news',
] as const;

export const FREE_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.jp', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'mail.com', 'protonmail.com', 'zoho.com',
] as const;

export const WARMUP_SCHEDULE_DEFAULT: WarmupDay[] = [
  { day: 1, limit: 50 },
  { day: 2, limit: 100 },
  { day: 3, limit: 150 },
  { day: 4, limit: 200 },
  { day: 5, limit: 300 },
  { day: 6, limit: 400 },
  { day: 7, limit: 500 },
  { day: 8, limit: 700 },
  { day: 9, limit: 900 },
  { day: 10, limit: 1200 },
  { day: 11, limit: 1500 },
  { day: 12, limit: 2000 },
  { day: 13, limit: 2500 },
  { day: 14, limit: 3000 },
  { day: 15, limit: 4000 },
  { day: 16, limit: 5000 },
  { day: 17, limit: 6000 },
  { day: 18, limit: 7000 },
  { day: 19, limit: 8500 },
  { day: 20, limit: 10000 },
];

export const ENGAGEMENT_THRESHOLDS = {
  highly_engaged: 80,
  engaged: 60,
  neutral: 40,
  disengaged: 20,
  inactive: 0,
} as const;

export const DELIVERABILITY_WEIGHTS = {
  domain_health: 0.25,
  list_quality: 0.25,
  engagement: 0.20,
  reputation: 0.20,
  content: 0.10,
} as const;
