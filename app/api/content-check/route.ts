import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkContent } from '@/lib/content/content-checker';
import { ContentCheckRequestSchema } from '@/lib/types/deliverability';

// POST /api/content-check - Check email content for deliverability issues
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ContentCheckRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { subject, body_text, body_html, from_email } = parsed.data;

    const result = await checkContent({
      subject,
      body_text,
      body_html,
      from_email,
    });

    // Save result to database
    const serviceClient = await createServiceClient();
    const campaignId = body.campaign_id;

    await serviceClient.from('content_checks').insert({
      campaign_id: campaignId || null,
      user_id: user.id,
      subject,
      body_preview: body_text.substring(0, 500),
      overall_score: result.overall_score,
      spam_score: result.spam_score,
      spam_words_found: result.spam_words_found,
      links_found: result.links_found,
      links_valid: result.links_valid,
      html_text_ratio: result.html_text_ratio,
      subject_score: result.subject_score,
      recommendations: result.recommendations,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Content check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
