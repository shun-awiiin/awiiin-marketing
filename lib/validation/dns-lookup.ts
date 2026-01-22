/**
 * DNS Lookup Service
 * Provides MX, SPF, DKIM, and DMARC record validation
 */

import dns from 'dns';
import { promisify } from 'util';
import type { AuthStatus } from '@/lib/types/deliverability';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

// ============================================
// MX RECORD LOOKUP
// ============================================

export interface MXRecord {
  exchange: string;
  priority: number;
}

export interface MXLookupResult {
  valid: boolean;
  records: MXRecord[];
  error?: string;
}

/**
 * Lookup MX records for a domain
 */
export async function lookupMX(domain: string): Promise<MXLookupResult> {
  try {
    const records = await resolveMx(domain);

    if (!records || records.length === 0) {
      return {
        valid: false,
        records: [],
        error: 'No MX records found',
      };
    }

    return {
      valid: true,
      records: records
        .map((r) => ({
          exchange: r.exchange,
          priority: r.priority,
        }))
        .sort((a, b) => a.priority - b.priority),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    let errorMessage = 'DNS lookup failed';

    if (err.code === 'ENOTFOUND') {
      errorMessage = 'Domain does not exist';
    } else if (err.code === 'ENODATA') {
      errorMessage = 'No MX records found';
    } else if (err.code === 'ETIMEOUT') {
      errorMessage = 'DNS lookup timed out';
    }

    return {
      valid: false,
      records: [],
      error: errorMessage,
    };
  }
}

// ============================================
// SPF RECORD LOOKUP
// ============================================

export interface SPFLookupResult {
  status: AuthStatus;
  record: string | null;
  details: string[];
  mechanisms: string[];
}

/**
 * Lookup and validate SPF record for a domain
 */
export async function lookupSPF(domain: string): Promise<SPFLookupResult> {
  try {
    const txtRecords = await resolveTxt(domain);
    const flatRecords = txtRecords.map((r) => r.join(''));

    // Find SPF record
    const spfRecord = flatRecords.find(
      (r) => r.startsWith('v=spf1') || r.startsWith('v=SPF1')
    );

    if (!spfRecord) {
      return {
        status: 'fail',
        record: null,
        details: ['No SPF record found for domain'],
        mechanisms: [],
      };
    }

    // Parse SPF mechanisms
    const mechanisms = spfRecord.split(' ').filter((m) => m !== 'v=spf1');
    const details: string[] = [];

    // Validate SPF record
    const hasAll = mechanisms.some((m) => m.endsWith('all'));
    const allMechanism = mechanisms.find((m) => m.endsWith('all'));

    if (!hasAll) {
      details.push('SPF record missing "all" mechanism');
    } else if (allMechanism === '+all') {
      details.push('Warning: SPF uses "+all" which allows any server to send');
    } else if (allMechanism === '~all') {
      details.push('SPF uses softfail "~all" (recommended: use "-all" for stricter policy)');
    } else if (allMechanism === '-all') {
      details.push('SPF uses strict "-all" policy (recommended)');
    }

    // Check for too many DNS lookups
    const lookupMechanisms = mechanisms.filter(
      (m) =>
        m.startsWith('include:') ||
        m.startsWith('a:') ||
        m.startsWith('mx:') ||
        m.startsWith('ptr:') ||
        m.startsWith('redirect=')
    );

    if (lookupMechanisms.length > 10) {
      details.push(
        `Warning: SPF record has ${lookupMechanisms.length} lookup mechanisms (max 10 recommended)`
      );
    }

    const status: AuthStatus =
      allMechanism === '-all' || allMechanism === '~all'
        ? 'pass'
        : allMechanism === '+all'
        ? 'fail'
        : 'partial';

    return {
      status,
      record: spfRecord,
      details,
      mechanisms,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return {
      status: 'fail',
      record: null,
      details: [`DNS lookup failed: ${err.code || err.message}`],
      mechanisms: [],
    };
  }
}

// ============================================
// DKIM RECORD LOOKUP
// ============================================

export interface DKIMLookupResult {
  status: AuthStatus;
  selector: string;
  record: string | null;
  details: string[];
  publicKey: string | null;
}

/**
 * Lookup DKIM record for a domain with specific selector
 */
export async function lookupDKIM(
  domain: string,
  selector: string = 'default'
): Promise<DKIMLookupResult> {
  const dkimDomain = `${selector}._domainkey.${domain}`;

  try {
    const txtRecords = await resolveTxt(dkimDomain);
    const record = txtRecords.map((r) => r.join('')).join('');

    if (!record) {
      return {
        status: 'fail',
        selector,
        record: null,
        details: [`No DKIM record found for selector "${selector}"`],
        publicKey: null,
      };
    }

    const details: string[] = [];
    let publicKey: string | null = null;

    // Parse DKIM record
    const parts = record.split(';').map((p) => p.trim());

    // Check for version
    const hasVersion = parts.some((p) => p.startsWith('v=DKIM1'));
    if (!hasVersion) {
      details.push('DKIM record missing version tag (v=DKIM1)');
    }

    // Extract public key
    const keyPart = parts.find((p) => p.startsWith('p='));
    if (keyPart) {
      publicKey = keyPart.substring(2);
      if (publicKey.length < 100) {
        details.push('Warning: DKIM key appears too short (consider using 2048-bit key)');
      }
    } else {
      details.push('DKIM record missing public key (p=)');
    }

    // Check key type
    const keyType = parts.find((p) => p.startsWith('k='));
    if (keyType && !keyType.includes('rsa')) {
      details.push(`DKIM uses ${keyType} key type`);
    }

    const status: AuthStatus = publicKey ? 'pass' : 'fail';

    return {
      status,
      selector,
      record,
      details: details.length > 0 ? details : ['DKIM record is properly configured'],
      publicKey,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return {
        status: 'fail',
        selector,
        record: null,
        details: [`No DKIM record found for selector "${selector}"`],
        publicKey: null,
      };
    }

    return {
      status: 'unknown',
      selector,
      record: null,
      details: [`DNS lookup failed: ${err.code || err.message}`],
      publicKey: null,
    };
  }
}

/**
 * Try common DKIM selectors for a domain
 */
export async function findDKIMSelector(domain: string): Promise<DKIMLookupResult | null> {
  const commonSelectors = [
    'default',
    'selector1',
    'selector2',
    'google',
    'k1',
    's1',
    's2',
    'mail',
    'email',
    'dkim',
    'ses',
    'amazonses',
  ];

  for (const selector of commonSelectors) {
    const result = await lookupDKIM(domain, selector);
    if (result.status === 'pass') {
      return result;
    }
  }

  return null;
}

// ============================================
// DMARC RECORD LOOKUP
// ============================================

export interface DMARCLookupResult {
  status: AuthStatus;
  record: string | null;
  policy: string | null;
  details: string[];
  parsed: {
    p?: string;
    sp?: string;
    pct?: number;
    rua?: string[];
    ruf?: string[];
    adkim?: string;
    aspf?: string;
  };
}

/**
 * Lookup and parse DMARC record for a domain
 */
export async function lookupDMARC(domain: string): Promise<DMARCLookupResult> {
  const dmarcDomain = `_dmarc.${domain}`;

  try {
    const txtRecords = await resolveTxt(dmarcDomain);
    const flatRecords = txtRecords.map((r) => r.join(''));

    const dmarcRecord = flatRecords.find((r) => r.startsWith('v=DMARC1'));

    if (!dmarcRecord) {
      return {
        status: 'fail',
        record: null,
        policy: null,
        details: ['No DMARC record found for domain'],
        parsed: {},
      };
    }

    const details: string[] = [];
    const parsed: DMARCLookupResult['parsed'] = {};

    // Parse DMARC tags
    const tags = dmarcRecord.split(';').map((t) => t.trim());

    for (const tag of tags) {
      const [key, value] = tag.split('=').map((s) => s.trim());

      switch (key) {
        case 'p':
          parsed.p = value;
          break;
        case 'sp':
          parsed.sp = value;
          break;
        case 'pct':
          parsed.pct = parseInt(value, 10);
          break;
        case 'rua':
          parsed.rua = value.split(',').map((s) => s.trim());
          break;
        case 'ruf':
          parsed.ruf = value.split(',').map((s) => s.trim());
          break;
        case 'adkim':
          parsed.adkim = value;
          break;
        case 'aspf':
          parsed.aspf = value;
          break;
      }
    }

    // Validate policy
    if (!parsed.p) {
      details.push('DMARC record missing policy (p=)');
    } else if (parsed.p === 'none') {
      details.push('DMARC policy is "none" (monitoring only, emails not rejected)');
    } else if (parsed.p === 'quarantine') {
      details.push('DMARC policy is "quarantine" (suspicious emails sent to spam)');
    } else if (parsed.p === 'reject') {
      details.push('DMARC policy is "reject" (recommended - unauthorized emails rejected)');
    }

    // Check reporting
    if (!parsed.rua) {
      details.push('No aggregate reporting address (rua) configured');
    }

    // Check percentage
    if (parsed.pct !== undefined && parsed.pct < 100) {
      details.push(`DMARC policy applies to only ${parsed.pct}% of emails`);
    }

    // Check alignment
    if (parsed.adkim === 's') {
      details.push('DKIM alignment is strict');
    }
    if (parsed.aspf === 's') {
      details.push('SPF alignment is strict');
    }

    let status: AuthStatus = 'partial';
    if (parsed.p === 'reject' || parsed.p === 'quarantine') {
      status = 'pass';
    } else if (!parsed.p) {
      status = 'fail';
    }

    return {
      status,
      record: dmarcRecord,
      policy: parsed.p || null,
      details: details.length > 0 ? details : ['DMARC record is properly configured'],
      parsed,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return {
        status: 'fail',
        record: null,
        policy: null,
        details: ['No DMARC record found for domain'],
        parsed: {},
      };
    }

    return {
      status: 'unknown',
      record: null,
      policy: null,
      details: [`DNS lookup failed: ${err.code || err.message}`],
      parsed: {},
    };
  }
}

// ============================================
// COMBINED DOMAIN CHECK
// ============================================

export interface FullDomainCheckResult {
  domain: string;
  mx: MXLookupResult;
  spf: SPFLookupResult;
  dkim: DKIMLookupResult;
  dmarc: DMARCLookupResult;
  overall_score: number;
  issues: string[];
}

/**
 * Perform comprehensive domain authentication check
 */
export async function checkDomainAuthentication(
  domain: string,
  dkimSelector?: string
): Promise<FullDomainCheckResult> {
  const [mx, spf, dkim, dmarc] = await Promise.all([
    lookupMX(domain),
    lookupSPF(domain),
    dkimSelector
      ? lookupDKIM(domain, dkimSelector)
      : findDKIMSelector(domain).then(
          (r) =>
            r || {
              status: 'fail' as AuthStatus,
              selector: 'unknown',
              record: null,
              details: ['No DKIM record found with common selectors'],
              publicKey: null,
            }
        ),
    lookupDMARC(domain),
  ]);

  const issues: string[] = [];
  let score = 100;

  // MX scoring (15 points)
  if (!mx.valid) {
    score -= 15;
    issues.push('No valid MX records');
  }

  // SPF scoring (30 points)
  if (spf.status === 'fail') {
    score -= 30;
    issues.push('SPF not configured');
  } else if (spf.status === 'partial') {
    score -= 15;
    issues.push('SPF partially configured');
  }

  // DKIM scoring (30 points)
  if (dkim.status === 'fail') {
    score -= 30;
    issues.push('DKIM not configured');
  } else if (dkim.status === 'partial') {
    score -= 15;
    issues.push('DKIM partially configured');
  }

  // DMARC scoring (25 points)
  if (dmarc.status === 'fail') {
    score -= 25;
    issues.push('DMARC not configured');
  } else if (dmarc.status === 'partial') {
    score -= 10;
    if (dmarc.policy === 'none') {
      issues.push('DMARC policy is monitoring only');
    }
  }

  return {
    domain,
    mx,
    spf,
    dkim,
    dmarc,
    overall_score: Math.max(0, score),
    issues,
  };
}
