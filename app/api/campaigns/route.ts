import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CampaignStatus, TemplateType } from '@/lib/types/database';
import { CreateCampaignSchema } from '@/lib/types/database';

// GET /api/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as CampaignStatus | null;
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '20');
    const offset = (page - 1) * perPage;

    let query = supabase
      .from('campaigns')
      .select(`
        *,
        templates(id, name, type)
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get stats for each campaign
    const campaignsWithStats = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        const { data: stats } = await supabase
          .from('messages')
          .select('status')
          .eq('campaign_id', campaign.id);

        const statusCounts = {
          total: stats?.length || 0,
          queued: 0,
          sending: 0,
          sent: 0,
          delivered: 0,
          bounced: 0,
          complained: 0,
          failed: 0
        };

        stats?.forEach(m => {
          if (m.status in statusCounts) {
            statusCounts[m.status as keyof typeof statusCounts]++;
          }
        });

        const sentTotal = statusCounts.sent + statusCounts.delivered + statusCounts.bounced + statusCounts.complained;
        const bounceRate = sentTotal > 0 ? (statusCounts.bounced / sentTotal) * 100 : 0;
        const complaintRate = sentTotal > 0 ? (statusCounts.complained / sentTotal) * 100 : 0;

        return {
          ...campaign,
          stats: {
            ...statusCounts,
            bounce_rate: Math.round(bounceRate * 100) / 100,
            complaint_rate: Math.round(complaintRate * 100) / 100
          }
        };
      })
    );

    return NextResponse.json({
      data: campaignsWithStats,
      meta: {
        total: count || 0,
        page,
        per_page: perPage
      }
    });
  } catch (error) {
    console.error('Campaigns fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns - Create campaign
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validation = CreateCampaignSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    const {
      name,
      type,
      template_id,
      input_payload,
      subject_index,
      filter_tag_ids,
      from_name,
      from_email,
      schedule_type,
      scheduled_at
    } = validation.data;

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Generate subject from selected variant
    const subjectVariants = template.subject_variants as string[];
    const selectedSubject = subjectVariants[subject_index] || subjectVariants[0];

    // Calculate audience count
    let audienceCount = 0;
    if (filter_tag_ids.length === 0) {
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active');
      audienceCount = count || 0;
    } else {
      const { data: contactIds } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', filter_tag_ids);

      const uniqueIds = [...new Set(contactIds?.map(c => c.contact_id) || [])];

      if (uniqueIds.length > 0) {
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('id', uniqueIds);
        audienceCount = count || 0;
      }
    }

    // Check max recipients
    if (audienceCount > 5000) {
      return NextResponse.json({
        error: 'Audience exceeds maximum of 5,000 recipients'
      }, { status: 400 });
    }

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        template_id,
        type: type as TemplateType,
        input_payload,
        subject_override: selectedSubject,
        body_override: template.body_text,
        filter_tags: filter_tag_ids.length > 0 ? filter_tag_ids : null,
        from_name,
        from_email,
        rate_limit_per_minute: 20,
        status: schedule_type === 'now' ? 'scheduled' : 'draft',
        scheduled_at: schedule_type === 'later' ? scheduled_at : new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ...campaign,
        audience_count: audienceCount
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
