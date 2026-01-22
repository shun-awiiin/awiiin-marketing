/**
 * Email Validation Service
 * Comprehensive email validation with MX verification, disposable detection,
 * role-based detection, and risk scoring
 */

import { createServiceClient } from '@/lib/supabase/server';
import { lookupMX } from './dns-lookup';
import type {
  EmailValidationResult,
  BatchValidationResult,
  EmailRiskLevel,
} from '@/lib/types/deliverability';
import { ROLE_BASED_PREFIXES, FREE_EMAIL_PROVIDERS } from '@/lib/types/deliverability';

// ============================================
// EMAIL SYNTAX VALIDATION
// ============================================

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const INVALID_PATTERNS = [
  /^[.-]/, // starts with dot or hyphen
  /[.-]$/, // ends with dot or hyphen
  /\.{2,}/, // consecutive dots
  /\s/, // contains whitespace
];

interface SyntaxValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email syntax
 */
function validateSyntax(email: string): SyntaxValidationResult {
  const errors: string[] = [];

  if (!email || typeof email !== 'string') {
    return { valid: false, errors: ['Email is required'] };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length === 0) {
    return { valid: false, errors: ['Email is empty'] };
  }

  if (trimmed.length > 254) {
    errors.push('Email exceeds maximum length (254 characters)');
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    errors.push('Invalid email format');
  }

  const [localPart, domain] = trimmed.split('@');

  if (!localPart || !domain) {
    errors.push('Email must contain @ symbol');
    return { valid: false, errors };
  }

  if (localPart.length > 64) {
    errors.push('Local part exceeds maximum length (64 characters)');
  }

  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(localPart)) {
      errors.push('Local part contains invalid character pattern');
      break;
    }
  }

  if (!domain.includes('.')) {
    errors.push('Domain must contain at least one dot');
  }

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    errors.push('Invalid top-level domain');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// DISPOSABLE EMAIL DETECTION
// ============================================

/**
 * Check if email domain is a known disposable email provider
 */
async function isDisposableEmail(domain: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('disposable_domains')
      .select('domain')
      .eq('domain', domain.toLowerCase())
      .single();

    return !!data;
  } catch {
    // If table doesn't exist or error, fall back to basic list
    const basicDisposableList = [
      'tempmail.com',
      'guerrillamail.com',
      '10minutemail.com',
      'mailinator.com',
      'throwaway.email',
      'yopmail.com',
      'getnada.com',
    ];
    return basicDisposableList.includes(domain.toLowerCase());
  }
}

// ============================================
// ROLE-BASED EMAIL DETECTION
// ============================================

/**
 * Check if email is a role-based address (info@, support@, etc.)
 */
function isRoleBasedEmail(email: string): boolean {
  const localPart = email.split('@')[0].toLowerCase();
  return ROLE_BASED_PREFIXES.some((prefix) => localPart === prefix);
}

// ============================================
// FREE PROVIDER DETECTION
// ============================================

/**
 * Check if email is from a free email provider
 */
function isFreeEmailProvider(domain: string): boolean {
  return FREE_EMAIL_PROVIDERS.includes(domain.toLowerCase() as typeof FREE_EMAIL_PROVIDERS[number]);
}

// ============================================
// RISK SCORING
// ============================================

interface RiskFactors {
  syntax_invalid: boolean;
  mx_invalid: boolean;
  is_disposable: boolean;
  is_role_based: boolean;
  is_free_provider: boolean;
  domain_age_unknown: boolean;
}

/**
 * Calculate risk score based on various factors
 * Returns score from 0 (highest risk) to 100 (lowest risk)
 */
function calculateRiskScore(factors: RiskFactors): { score: number; level: EmailRiskLevel } {
  let score = 100;

  // Critical factors
  if (factors.syntax_invalid) {
    score -= 100; // Invalid syntax = maximum risk
  }

  if (factors.mx_invalid) {
    score -= 50; // No MX records = high risk
  }

  if (factors.is_disposable) {
    score -= 40; // Disposable email = high risk
  }

  // Moderate factors
  if (factors.is_role_based) {
    score -= 15; // Role-based = moderate risk
  }

  // Low factors
  if (factors.is_free_provider) {
    score -= 5; // Free provider = slight risk
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let level: EmailRiskLevel;
  if (score >= 80) {
    level = 'low';
  } else if (score >= 50) {
    level = 'medium';
  } else if (score >= 20) {
    level = 'high';
  } else {
    level = 'critical';
  }

  return { score, level };
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

export interface ValidateEmailOptions {
  skipMxCheck?: boolean;
  skipCacheCheck?: boolean;
  cacheResult?: boolean;
}

/**
 * Validate a single email address
 */
export async function validateEmail(
  email: string,
  options: ValidateEmailOptions = {}
): Promise<EmailValidationResult> {
  const { skipMxCheck = false, skipCacheCheck = false, cacheResult = true } = options;

  const normalizedEmail = email.trim().toLowerCase();

  // Check cache first
  if (!skipCacheCheck) {
    const cached = await getCachedValidation(normalizedEmail);
    if (cached) {
      return cached;
    }
  }

  // Syntax validation
  const syntaxResult = validateSyntax(normalizedEmail);
  const domain = normalizedEmail.split('@')[1] || '';

  // Start collecting validation data
  const detectedIssues: string[] = [];
  let mxValid: boolean | null = null;
  let mxRecords: string[] = [];

  // MX record validation
  if (syntaxResult.valid && !skipMxCheck) {
    const mxResult = await lookupMX(domain);
    mxValid = mxResult.valid;
    mxRecords = mxResult.records.map((r) => r.exchange);

    if (!mxValid) {
      detectedIssues.push(mxResult.error || 'No MX records found');
    }
  }

  // Disposable email check
  const isDisposable = syntaxResult.valid ? await isDisposableEmail(domain) : false;
  if (isDisposable) {
    detectedIssues.push('Disposable email domain');
  }

  // Role-based email check
  const isRoleBased = syntaxResult.valid ? isRoleBasedEmail(normalizedEmail) : false;
  if (isRoleBased) {
    detectedIssues.push('Role-based email address');
  }

  // Free provider check
  const isFreeProvider = syntaxResult.valid ? isFreeEmailProvider(domain) : false;

  // Calculate risk
  const { score, level } = calculateRiskScore({
    syntax_invalid: !syntaxResult.valid,
    mx_invalid: mxValid === false,
    is_disposable: isDisposable,
    is_role_based: isRoleBased,
    is_free_provider: isFreeProvider,
    domain_age_unknown: true, // We don't check domain age for now
  });

  const result: EmailValidationResult = {
    email: normalizedEmail,
    syntax_valid: syntaxResult.valid,
    mx_valid: mxValid,
    mx_records: mxRecords,
    is_disposable: isDisposable,
    is_role_based: isRoleBased,
    is_free_provider: isFreeProvider,
    risk_level: level,
    risk_score: score,
    validation_details: {
      syntax_errors: syntaxResult.errors.length > 0 ? syntaxResult.errors : undefined,
      mx_lookup_error: mxValid === false ? 'MX lookup failed' : undefined,
      detected_issues: detectedIssues.length > 0 ? detectedIssues : undefined,
    },
    validated_at: new Date().toISOString(),
  };

  // Cache result
  if (cacheResult && syntaxResult.valid) {
    await cacheValidationResult(result);
  }

  return result;
}

/**
 * Validate multiple email addresses in batch
 */
export async function validateEmailBatch(
  emails: string[],
  options: ValidateEmailOptions = {}
): Promise<BatchValidationResult> {
  const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()))];

  const results = await Promise.all(
    uniqueEmails.map((email) => validateEmail(email, options))
  );

  const summary = {
    low_risk: results.filter((r) => r.risk_level === 'low').length,
    medium_risk: results.filter((r) => r.risk_level === 'medium').length,
    high_risk: results.filter((r) => r.risk_level === 'high').length,
    critical_risk: results.filter((r) => r.risk_level === 'critical').length,
  };

  return {
    total: results.length,
    valid: results.filter((r) => r.syntax_valid && r.mx_valid !== false).length,
    invalid: results.filter((r) => !r.syntax_valid || r.mx_valid === false).length,
    results,
    summary,
  };
}

// ============================================
// CACHE FUNCTIONS
// ============================================

/**
 * Get cached validation result
 */
async function getCachedValidation(email: string): Promise<EmailValidationResult | null> {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('email_validations')
      .select('*')
      .eq('email', email)
      .single();

    if (!data) return null;

    // Check if cache is still fresh (24 hours)
    const validatedAt = new Date(data.validated_at);
    const now = new Date();
    const hoursSinceValidation = (now.getTime() - validatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceValidation > 24) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      syntax_valid: data.syntax_valid,
      mx_valid: data.mx_valid,
      mx_records: data.mx_records || [],
      is_disposable: data.is_disposable,
      is_role_based: data.is_role_based,
      is_free_provider: data.is_free_provider,
      risk_level: data.risk_level,
      risk_score: data.risk_score,
      validation_details: data.validation_details || {},
      validated_at: data.validated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Cache validation result in database
 */
async function cacheValidationResult(result: EmailValidationResult): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from('email_validations').upsert(
      {
        email: result.email,
        syntax_valid: result.syntax_valid,
        mx_valid: result.mx_valid,
        mx_records: result.mx_records,
        is_disposable: result.is_disposable,
        is_role_based: result.is_role_based,
        is_free_provider: result.is_free_provider,
        risk_level: result.risk_level,
        risk_score: result.risk_score,
        validation_details: result.validation_details,
        validated_at: result.validated_at,
      },
      { onConflict: 'email' }
    );
  } catch (error) {
    console.error('Failed to cache validation result:', error);
  }
}

// ============================================
// QUICK VALIDATION (NO DATABASE)
// ============================================

/**
 * Quick email validation without database operations
 * Useful for client-side or quick checks
 */
export function quickValidateEmail(email: string): {
  valid: boolean;
  errors: string[];
  isRoleBased: boolean;
  isFreeProvider: boolean;
} {
  const syntaxResult = validateSyntax(email);
  const domain = email.split('@')[1] || '';

  return {
    valid: syntaxResult.valid,
    errors: syntaxResult.errors,
    isRoleBased: syntaxResult.valid && isRoleBasedEmail(email),
    isFreeProvider: syntaxResult.valid && isFreeEmailProvider(domain),
  };
}

/**
 * Simple email format check (for forms)
 */
export function isValidEmail(email: string): boolean {
  return validateSyntax(email).valid;
}
