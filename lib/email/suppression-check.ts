/**
 * Suppression Check Service
 * Filters out contacts that should not receive emails
 * (bounced, complained, unsubscribed)
 */

import { createServiceClient } from '@/lib/supabase/server';

export type SuppressionReason = 'bounced' | 'complained' | 'unsubscribed' | 'inactive';

export interface SuppressionCheckResult {
  email: string;
  isSuppressed: boolean;
  reason?: SuppressionReason;
}

export interface BulkSuppressionCheckResult {
  allowed: string[];
  suppressed: Array<{ email: string; reason: SuppressionReason }>;
}

/**
 * Check if a single email address is suppressed
 */
export async function checkSuppression(email: string): Promise<SuppressionCheckResult> {
  const supabase = await createServiceClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Check unsubscribes table first (most explicit)
  const { data: unsubscribe } = await supabase
    .from('unsubscribes')
    .select('email')
    .eq('email', normalizedEmail)
    .single();

  if (unsubscribe) {
    return { email, isSuppressed: true, reason: 'unsubscribed' };
  }

  // Check contact status
  const { data: contact } = await supabase
    .from('contacts')
    .select('status')
    .eq('email', normalizedEmail)
    .single();

  if (contact) {
    switch (contact.status) {
      case 'bounced':
        return { email, isSuppressed: true, reason: 'bounced' };
      case 'complained':
        return { email, isSuppressed: true, reason: 'complained' };
      case 'unsubscribed':
        return { email, isSuppressed: true, reason: 'unsubscribed' };
      case 'inactive':
        return { email, isSuppressed: true, reason: 'inactive' };
    }
  }

  return { email, isSuppressed: false };
}

/**
 * Check multiple email addresses for suppression (bulk operation)
 * More efficient than checking one by one
 */
export async function checkBulkSuppression(
  emails: string[]
): Promise<BulkSuppressionCheckResult> {
  if (emails.length === 0) {
    return { allowed: [], suppressed: [] };
  }

  const supabase = await createServiceClient();
  const normalizedEmails = emails.map(e => e.toLowerCase().trim());

  // Get all unsubscribed emails
  const { data: unsubscribes } = await supabase
    .from('unsubscribes')
    .select('email')
    .in('email', normalizedEmails);

  const unsubscribedSet = new Set(unsubscribes?.map(u => u.email) || []);

  // Get all contacts with suppressed statuses
  const { data: suppressedContacts } = await supabase
    .from('contacts')
    .select('email, status')
    .in('email', normalizedEmails)
    .in('status', ['bounced', 'complained', 'unsubscribed', 'inactive']);

  const suppressedMap = new Map<string, SuppressionReason>();

  // Add unsubscribed emails
  for (const email of unsubscribedSet) {
    suppressedMap.set(email, 'unsubscribed');
  }

  // Add contacts with suppressed statuses
  for (const contact of suppressedContacts || []) {
    if (!suppressedMap.has(contact.email)) {
      suppressedMap.set(contact.email, contact.status as SuppressionReason);
    }
  }

  // Separate allowed and suppressed
  const allowed: string[] = [];
  const suppressed: Array<{ email: string; reason: SuppressionReason }> = [];

  for (const email of normalizedEmails) {
    const reason = suppressedMap.get(email);
    if (reason) {
      suppressed.push({ email, reason });
    } else {
      allowed.push(email);
    }
  }

  return { allowed, suppressed };
}

/**
 * Filter contacts for a campaign, returning only sendable contacts
 */
export async function filterSendableContacts(
  contactIds: string[]
): Promise<{
  sendable: Array<{ id: string; email: string }>;
  filtered: Array<{ id: string; email: string; reason: SuppressionReason }>;
}> {
  if (contactIds.length === 0) {
    return { sendable: [], filtered: [] };
  }

  const supabase = await createServiceClient();

  // Get contacts with their status
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, status')
    .in('id', contactIds);

  if (!contacts || contacts.length === 0) {
    return { sendable: [], filtered: [] };
  }

  // Get all emails to check against unsubscribes
  const emails = contacts.map(c => c.email.toLowerCase());
  const { data: unsubscribes } = await supabase
    .from('unsubscribes')
    .select('email')
    .in('email', emails);

  const unsubscribedSet = new Set(unsubscribes?.map(u => u.email) || []);

  const sendable: Array<{ id: string; email: string }> = [];
  const filtered: Array<{ id: string; email: string; reason: SuppressionReason }> = [];

  for (const contact of contacts) {
    const normalizedEmail = contact.email.toLowerCase();

    // Check unsubscribe list first
    if (unsubscribedSet.has(normalizedEmail)) {
      filtered.push({ id: contact.id, email: contact.email, reason: 'unsubscribed' });
      continue;
    }

    // Check contact status
    switch (contact.status) {
      case 'bounced':
        filtered.push({ id: contact.id, email: contact.email, reason: 'bounced' });
        break;
      case 'complained':
        filtered.push({ id: contact.id, email: contact.email, reason: 'complained' });
        break;
      case 'unsubscribed':
        filtered.push({ id: contact.id, email: contact.email, reason: 'unsubscribed' });
        break;
      case 'inactive':
        filtered.push({ id: contact.id, email: contact.email, reason: 'inactive' });
        break;
      default:
        // active or any other status is sendable
        sendable.push({ id: contact.id, email: contact.email });
    }
  }

  return { sendable, filtered };
}

/**
 * Add email to suppression list
 */
export async function addToSuppressionList(
  email: string,
  reason: SuppressionReason
): Promise<void> {
  const supabase = await createServiceClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Update contact status
  await supabase
    .from('contacts')
    .update({ status: reason })
    .eq('email', normalizedEmail);

  // If unsubscribed or complained, also add to unsubscribes table
  if (reason === 'unsubscribed' || reason === 'complained') {
    await supabase
      .from('unsubscribes')
      .upsert(
        { email: normalizedEmail, reason: reason === 'complained' ? 'Spam complaint' : 'User request' },
        { onConflict: 'email' }
      );
  }
}

/**
 * Remove email from suppression list (re-activate)
 * Use with caution - typically only for user-requested re-subscription
 */
export async function removeFromSuppressionList(email: string): Promise<void> {
  const supabase = await createServiceClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Update contact status to active
  await supabase
    .from('contacts')
    .update({ status: 'active', soft_bounce_count: 0 })
    .eq('email', normalizedEmail);

  // Remove from unsubscribes
  await supabase
    .from('unsubscribes')
    .delete()
    .eq('email', normalizedEmail);
}
