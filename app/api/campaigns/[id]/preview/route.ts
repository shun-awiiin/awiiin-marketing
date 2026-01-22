import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildContext,
  generateSubject,
  generateEmailBody
} from '@/lib/email/template-renderer';
import type { TemplateType, SeminarInvitePayload, FreeTrialInvitePayload } from '@/lib/types/database';

// POST /api/campaigns/:id/preview - Generate preview
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

    const body = await request.json();
    const { sample_contact_id } = body;

    // Get campaign with template
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        templates(*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get sample contact
    let firstName: string | null = null;
    let email = 'sample@example.com';

    if (sample_contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('email, first_name')
        .eq('id', sample_contact_id)
        .eq('user_id', user.id)
        .single();

      if (contact) {
        firstName = contact.first_name;
        email = contact.email;
      }
    }

    const template = campaign.templates;
    const inputPayload = campaign.input_payload as SeminarInvitePayload | FreeTrialInvitePayload;
    const subjectVariants = template.subject_variants as string[];

    // Find subject index from subject_override
    const subjectIndex = subjectVariants.findIndex(s => s === campaign.subject_override) || 0;

    // Build context and generate content
    const context = buildContext(
      campaign.type as TemplateType,
      inputPayload,
      firstName
    );

    const subject = generateSubject(
      campaign.type as TemplateType,
      subjectIndex,
      firstName
    );

    const bodyText = generateEmailBody(
      campaign.body_override || template.body_text,
      context,
      '[配信停止リンク]'
    );

    return NextResponse.json({
      data: {
        subject,
        body_text: bodyText,
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: email
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
