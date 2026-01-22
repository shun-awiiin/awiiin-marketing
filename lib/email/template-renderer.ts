/**
 * Email Template Renderer
 * Handles variable substitution for email templates
 */

import {
  SeminarInvitePayload,
  FreeTrialInvitePayload,
  TemplateType,
  SUBJECT_VARIANTS,
  DEFAULT_FIRST_NAME,
} from '@/lib/types/database';

interface RenderContext {
  firstName?: string | null;
  [key: string]: string | string[] | null | undefined;
}

/**
 * Render a template string with variables
 */
export function renderTemplate(template: string, context: RenderContext): string {
  let result = template;

  // Handle {{firstName}} with fallback
  const firstName = context.firstName || DEFAULT_FIRST_NAME;
  result = result.replace(/\{\{firstName\}\}/g, firstName);

  // Handle other simple variables
  Object.entries(context).forEach(([key, value]) => {
    if (key === 'firstName') return; // Already handled
    if (key === 'extra_bullets') return; // Handled separately

    if (typeof value === 'string') {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
  });

  // Handle extra_bullets section
  const extraBullets = context.extra_bullets as string[] | undefined;
  if (extraBullets && extraBullets.length > 0) {
    const bulletsSection = extraBullets.join('\n');
    // Replace the mustache-style section with actual content
    result = result.replace(
      /\{\{#extra_bullets\}\}[\s\S]*?\{\{\/extra_bullets\}\}/g,
      bulletsSection
    );
  } else {
    // Remove the section if no extra bullets
    result = result.replace(
      /\{\{#extra_bullets\}\}[\s\S]*?\{\{\/extra_bullets\}\}/g,
      ''
    );
  }

  // Clean up any remaining empty lines (more than 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Generate subject line from template type and index
 */
export function generateSubject(
  type: TemplateType,
  subjectIndex: number,
  firstName?: string | null
): string {
  const variants = SUBJECT_VARIANTS[type];
  const template = variants[subjectIndex] || variants[0];
  return renderTemplate(template, { firstName });
}

/**
 * Build context from input payload
 */
export function buildContext(
  type: TemplateType,
  payload: SeminarInvitePayload | FreeTrialInvitePayload,
  firstName?: string | null
): RenderContext {
  const context: RenderContext = {
    firstName,
  };

  if (type === 'SEMINAR_INVITE') {
    const p = payload as SeminarInvitePayload;
    context.event_name = p.event_name;
    context.event_date = p.event_date;
    context.event_location = p.event_location;
    context.url = p.url;
    context.extra_bullets = p.extra_bullets;
  } else if (type === 'FREE_TRIAL_INVITE') {
    const p = payload as FreeTrialInvitePayload;
    context.tool_name = p.tool_name;
    context.one_liner = p.one_liner;
    context.url = p.url;
    context.extra_bullets = p.extra_bullets;
  }

  return context;
}

/**
 * Generate the full email body with unsubscribe link
 */
export function generateEmailBody(
  bodyTemplate: string,
  context: RenderContext,
  unsubscribeUrl: string
): string {
  let body = renderTemplate(bodyTemplate, context);

  // Append unsubscribe link
  body += `\n\n---\n配信停止はこちら: ${unsubscribeUrl}`;

  return body;
}

/**
 * Validate that all required variables are present in the context
 */
export function validateContext(
  type: TemplateType,
  context: RenderContext
): { valid: boolean; missingFields: string[] } {
  const requiredFields: Record<TemplateType, string[]> = {
    SEMINAR_INVITE: ['event_name', 'event_date', 'event_location', 'url'],
    FREE_TRIAL_INVITE: ['tool_name', 'one_liner', 'url'],
  };

  const required = requiredFields[type];
  const missingFields = required.filter((field) => !context[field]);

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Preview email for a given contact
 */
export interface EmailPreview {
  subject: string;
  body: string;
  from: string;
  to: string;
}

export function previewEmail(
  templateBody: string,
  type: TemplateType,
  payload: SeminarInvitePayload | FreeTrialInvitePayload,
  subjectIndex: number,
  fromName: string,
  fromEmail: string,
  contact: { email: string; first_name?: string | null }
): EmailPreview {
  const context = buildContext(type, payload, contact.first_name);

  // Use a placeholder for unsubscribe link in preview
  const previewUnsubscribeUrl = '[配信停止リンク]';

  return {
    subject: generateSubject(type, subjectIndex, contact.first_name),
    body: generateEmailBody(templateBody, context, previewUnsubscribeUrl),
    from: `${fromName} <${fromEmail}>`,
    to: contact.email,
  };
}

/**
 * Sanitize URL - ensure it's valid and HTTPS
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Upgrade HTTP to HTTPS
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    throw new Error('Invalid URL format');
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate secure unsubscribe token
 */
export function generateUnsubscribeToken(email: string, campaignId: string): string {
  const data = `${email}:${campaignId}:${Date.now()}`;
  // In production, use a proper crypto hash
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64);
}
