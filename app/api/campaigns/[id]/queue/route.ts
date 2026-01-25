import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildContext,
  generateSubject,
  generateEmailBody,
  generateUnsubscribeToken
} from '@/lib/email/template-renderer';
import type { TemplateType, SeminarInvitePayload, FreeTrialInvitePayload } from '@/lib/types/database';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// POST /api/campaigns/:id/queue - Queue campaign for sending
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get campaign with template
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        templates(*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check status
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json({ error: 'Campaign cannot be queued' }, { status: 400 });
    }

    // Get target contacts
    let contacts: { id: string | null; email: string; first_name: string | null }[] = [];

    // Check if specific_emails is set
    if (campaign.specific_emails && campaign.specific_emails.length > 0) {
      // Use specific emails directly
      contacts = campaign.specific_emails.map((email: string) => ({
        id: null, // No contact ID for direct email addresses
        email,
        first_name: null
      }));
    } else {
      // Get from contacts table
      let contactsQuery = supabase
        .from('contacts')
        .select('id, email, first_name')
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Apply tag filter
      if (campaign.filter_tags && campaign.filter_tags.length > 0) {
        const { data: taggedContactIds } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', campaign.filter_tags);

        if (taggedContactIds && taggedContactIds.length > 0) {
          const uniqueIds = [...new Set(taggedContactIds.map(tc => tc.contact_id))];
          contactsQuery = contactsQuery.in('id', uniqueIds);
        } else {
          // No contacts with these tags
          return NextResponse.json({
            error: 'No contacts match the selected tags'
          }, { status: 400 });
        }
      }

      const { data: contactsData, error: contactsError } = await contactsQuery;

      if (contactsError) {
        return NextResponse.json({ error: contactsError.message }, { status: 500 });
      }

      contacts = contactsData || [];
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts to send' }, { status: 400 });
    }

    // Check max recipients
    if (contacts.length > 5000) {
      return NextResponse.json({
        error: 'Audience exceeds maximum of 5,000 recipients'
      }, { status: 400 });
    }

    // Get unsubscribed emails
    const { data: unsubscribes } = await supabase
      .from('unsubscribes')
      .select('email');

    const unsubscribedSet = new Set(
      unsubscribes?.map(u => u.email.toLowerCase()) || []
    );

    // Filter out unsubscribed
    const activeContacts = contacts.filter(
      c => !unsubscribedSet.has(c.email.toLowerCase())
    );

    if (activeContacts.length === 0) {
      return NextResponse.json({
        error: 'All contacts have unsubscribed'
      }, { status: 400 });
    }

    // Generate messages
    const template = campaign.templates;
    const inputPayload = campaign.input_payload as SeminarInvitePayload | FreeTrialInvitePayload;
    const subjectVariants = template.subject_variants as string[];
    const subjectIndex = subjectVariants.findIndex(s => s === campaign.subject_override) || 0;

    const messages = activeContacts.map(contact => {
      const context = buildContext(
        campaign.type as TemplateType,
        inputPayload,
        contact.first_name
      );

      const subject = generateSubject(
        campaign.type as TemplateType,
        subjectIndex,
        contact.first_name
      );

      // Generate unsubscribe token and URL
      const token = generateUnsubscribeToken(contact.email, id);
      const unsubscribeUrl = `${APP_URL}/u/${token}`;

      const bodyText = generateEmailBody(
        campaign.body_override || template.body_text,
        context,
        unsubscribeUrl
      );

      return {
        campaign_id: id,
        contact_id: contact.id || null,
        to_email: contact.email,
        subject,
        body_text: bodyText,
        status: 'queued' as const
      };
    });

    // Store unsubscribe tokens (only for contacts with valid IDs or direct emails)
    const unsubscribeInserts = activeContacts
      .filter(contact => contact.email)
      .map(contact => ({
        email: contact.email.toLowerCase(),
        contact_id: contact.id || null,
        campaign_id: id,
        token: generateUnsubscribeToken(contact.email, id)
      }));

    // Upsert unsubscribe tokens (don't fail if exists)
    for (const unsub of unsubscribeInserts) {
      await supabase
        .from('unsubscribes')
        .upsert(unsub, { onConflict: 'email', ignoreDuplicates: true });
    }

    // Batch insert messages
    const batchSize = 500;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('messages')
        .insert(batch);

      if (insertError) {
        console.error('Message insert error:', insertError);
        return NextResponse.json({ 
          error: `Failed to create messages: ${insertError.message}`,
          details: insertError
        }, { status: 500 });
      }
    }

    // Update campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'queued',
        started_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Calculate estimated completion time
    const ratePerMinute = campaign.rate_limit_per_minute || 20;
    const estimatedMinutes = Math.ceil(messages.length / ratePerMinute);
    const estimatedCompletion = new Date(
      Date.now() + estimatedMinutes * 60 * 1000
    ).toISOString();

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'campaign.queue',
      target_type: 'campaign',
      target_id: id,
      payload: {
        total_messages: messages.length,
        rate_per_minute: ratePerMinute
      }
    });

    // Trigger the send process (in background)
    // In production, this would be a background job/queue
    triggerSendProcess(id);

    return NextResponse.json({
      data: {
        campaign_id: id,
        status: 'queued',
        total_messages: messages.length,
        estimated_completion: estimatedCompletion
      }
    });
  } catch (error) {
    console.error('Queue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Trigger background send process
async function triggerSendProcess(campaignId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Fire and forget - don't await
    fetch(`${baseUrl}/api/campaigns/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId })
    }).catch(err => console.error('Failed to trigger send:', err));
  } catch (error) {
    console.error('Trigger send error:', error);
  }
}
