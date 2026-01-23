/**
 * Database Types for HubSpot Alternative Email Tool
 * Auto-generated from schema - DO NOT EDIT DIRECTLY
 */

// ============================================
// ENUMS
// ============================================

export type UserRole = 'admin' | 'editor' | 'viewer';

export type ContactStatus = 'active' | 'bounced' | 'complained' | 'unsubscribed';

export type TemplateType = 'SEMINAR_INVITE' | 'FREE_TRIAL_INVITE';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'failed';

export type MessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed';

// ============================================
// TABLE TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  status: ContactStatus;
  soft_bounce_count: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  contact_id: string;
  tag_id: string;
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string | null;
  name: string;
  type: TemplateType;
  category: string;
  subject_variants: string[];
  body_text: string;
  body_html: string | null;
  is_preset: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  template_id: string;
  type: TemplateType;
  input_payload: SeminarInvitePayload | FreeTrialInvitePayload;
  subject_override: string | null;
  body_override: string | null;
  variables: Record<string, string> | null;
  filter_tags: string[] | null;
  from_name: string;
  from_email: string;
  rate_limit_per_minute: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  campaign_id: string;
  contact_id: string;
  to_email: string;
  subject: string;
  body_text: string;
  status: MessageStatus;
  provider_message_id: string | null;
  retry_count: number;
  last_error: string | null;
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  provider: 'ses' | 'resend' | 'sendgrid';
  provider_message_id: string | null;
  event_type: string;
  email: string | null;
  campaign_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
}

export interface Unsubscribe {
  id: string;
  email: string;
  contact_id: string | null;
  campaign_id: string | null;
  token: string | null;
  reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// INPUT PAYLOADS
// ============================================

export interface SeminarInvitePayload {
  event_name: string;
  event_date: string;
  event_location: string;
  url: string;
  extra_bullets?: string[];
}

export interface FreeTrialInvitePayload {
  tool_name: string;
  one_liner: string;
  url: string;
  extra_bullets?: string[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Contacts
export interface ContactImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: Array<{
    row: number;
    email: string;
    reason: string;
  }>;
}

export interface ContactWithTags extends Contact {
  tags: Tag[];
}

// Campaigns
export interface CreateCampaignRequest {
  name: string;
  type: TemplateType;
  template_id: string;
  input_payload: SeminarInvitePayload | FreeTrialInvitePayload;
  subject_index: number;
  filter_tag_ids: string[];
  from_name: string;
  from_email: string;
  schedule_type: 'now' | 'later';
  scheduled_at?: string;
}

export interface CampaignPreview {
  subject: string;
  body_text: string;
  from: string;
  to: string;
}

export interface CampaignStats {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  bounce_rate: number;
  complaint_rate: number;
}

export interface CampaignWithStats extends Campaign {
  template: Template;
  stats: CampaignStats;
}

export interface QueueCampaignResult {
  campaign_id: string;
  status: CampaignStatus;
  total_messages: number;
  estimated_completion: string;
}

// ============================================
// VALIDATION SCHEMAS (Zod)
// ============================================

import { z } from 'zod';

export const SeminarInvitePayloadSchema = z.object({
  event_name: z.string().min(1).max(60),
  event_date: z.string().min(1).max(30),
  event_location: z.string().min(1).max(40),
  url: z.string().url(),
  extra_bullets: z.array(z.string().max(80)).max(3).optional(),
});

export const FreeTrialInvitePayloadSchema = z.object({
  tool_name: z.string().min(1).max(30),
  one_liner: z.string().min(1).max(120),
  url: z.string().url(),
  extra_bullets: z.array(z.string().max(80)).max(3).optional(),
});

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['SEMINAR_INVITE', 'FREE_TRIAL_INVITE']),
  template_id: z.string().uuid(),
  input_payload: z.union([SeminarInvitePayloadSchema, FreeTrialInvitePayloadSchema]),
  subject_index: z.number().int().min(0).max(2),
  filter_tag_ids: z.array(z.string().uuid()),
  from_name: z.string().min(1).max(100),
  from_email: z.string().email(),
  schedule_type: z.enum(['now', 'later']),
  scheduled_at: z.string().datetime().optional(),
});

export const ContactImportRowSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  tags: z.string().optional(), // comma-separated
});

// ============================================
// CONSTANTS
// ============================================

export const RATE_LIMITS = {
  DEFAULT_PER_MINUTE: 20,
  MAX_PER_MINUTE: 200,
  INITIAL_DAILY_LIMIT: 200,
  INITIAL_PERIOD_DAYS: 7,
} as const;

export const AUTO_STOP_THRESHOLDS = {
  BOUNCE_RATE_PERCENT: 2,  // 仕様: 2%以上で自動停止
  COMPLAINT_RATE_PERCENT: 0.1,  // 仕様: 0.1%以上で即停止
  CONSECUTIVE_FAILURES: 10,
} as const;

export const MAX_CAMPAIGN_RECIPIENTS = 5000;
export const MAX_EXTRA_BULLETS = 3;
export const MAX_BULLET_LENGTH = 80;

export const SUBJECT_VARIANTS = {
  SEMINAR_INVITE: [
    '{{firstName}}さん、1点だけ共有です',
    '{{firstName}}さん向けにご連絡です（短時間）',
    '{{firstName}}さん、来週の件でご案内です',
  ],
  FREE_TRIAL_INVITE: [
    '{{firstName}}さん、先日の件で1点だけ',
    '{{firstName}}さん向けに共有です',
    '{{firstName}}さん、ご参考までに',
  ],
} as const;

export const DEFAULT_FIRST_NAME = 'ご担当者さま';

// ============================================
// TEST SEND TYPES
// ============================================

export interface TestSendRequest {
  recipient_email: string;
  include_preview?: boolean;
  sample_first_name?: string;
}

export interface TestSendResult {
  success: boolean;
  message_id?: string;
  preview: {
    subject: string;
    body_text: string;
    from: string;
    to: string;
  };
  error?: string;
}

export const TestSendRequestSchema = z.object({
  recipient_email: z.string().email('有効なメールアドレスを入力してください'),
  include_preview: z.boolean().default(true),
  sample_first_name: z.string().max(50).optional(),
});

export const TEST_SEND_RATE_LIMIT = {
  MAX_PER_HOUR: 5,
  WINDOW_MS: 60 * 60 * 1000, // 1 hour
} as const;

// ============================================
// SCHEDULED SEND TYPES
// ============================================

export type ScheduledJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScheduledJob {
  id: string;
  campaign_id: string;
  scheduled_at: string;
  status: ScheduledJobStatus;
  attempts: number;
  last_error: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface ScheduledSendResult {
  processed: number;
  succeeded: number;
  failed: number;
  jobs: Array<{
    campaign_id: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

// ============================================
// REALTIME STATS TYPES
// ============================================

export interface RealtimeStats extends CampaignStats {
  last_updated: Date;
  is_connected: boolean;
}

// ============================================
// SUPABASE DATABASE TYPES (for client)
// ============================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Partial<User> & { id: string; email: string };
        Update: Partial<User>;
        Relationships: [];
      };
      contacts: {
        Row: Contact;
        Insert: Partial<Contact> & { user_id: string; email: string };
        Update: Partial<Contact>;
        Relationships: [];
      };
      tags: {
        Row: Tag;
        Insert: Partial<Tag> & { user_id: string; name: string };
        Update: Partial<Tag>;
        Relationships: [];
      };
      contact_tags: {
        Row: ContactTag;
        Insert: { contact_id: string; tag_id: string };
        Update: Partial<ContactTag>;
        Relationships: [];
      };
      templates: {
        Row: Template;
        Insert: Partial<Template> & { name: string; type: TemplateType; body_text: string };
        Update: Partial<Template>;
        Relationships: [];
      };
      campaigns: {
        Row: Campaign;
        Insert: Partial<Campaign> & { user_id: string; name: string; template_id: string };
        Update: Partial<Campaign>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & { campaign_id: string; contact_id: string; to_email: string; subject: string; body_text: string };
        Update: Partial<Message>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Partial<Event> & { provider: 'ses' | 'resend' | 'sendgrid'; event_type: string };
        Update: Partial<Event>;
        Relationships: [];
      };
      unsubscribes: {
        Row: Unsubscribe;
        Insert: Partial<Unsubscribe> & { email: string };
        Update: Partial<Unsubscribe>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { action: string };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_campaign_stats: {
        Args: { p_campaign_id: string };
        Returns: CampaignStats[];
      };
      should_auto_stop_campaign: {
        Args: { p_campaign_id: string };
        Returns: Array<{ should_stop: boolean; reason: string | null }>;
      };
    };
    Enums: {
      user_role: UserRole;
      contact_status: ContactStatus;
      template_type: TemplateType;
      campaign_status: CampaignStatus;
      message_status: MessageStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
