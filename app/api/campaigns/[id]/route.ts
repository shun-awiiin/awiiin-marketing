import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/campaigns/:id - Get campaign details
export async function GET(
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

    // Get stats
    const { data: messages } = await supabase
      .from('messages')
      .select('status')
      .eq('campaign_id', id);

    const statusCounts = {
      total: messages?.length || 0,
      queued: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      failed: 0
    };

    messages?.forEach(m => {
      if (m.status in statusCounts) {
        statusCounts[m.status as keyof typeof statusCounts]++;
      }
    });

    const sentTotal = statusCounts.sent + statusCounts.delivered + statusCounts.bounced + statusCounts.complained;
    const bounceRate = sentTotal > 0 ? (statusCounts.bounced / sentTotal) * 100 : 0;
    const complaintRate = sentTotal > 0 ? (statusCounts.complained / sentTotal) * 100 : 0;

    return NextResponse.json({
      data: {
        ...campaign,
        stats: {
          ...statusCounts,
          bounce_rate: Math.round(bounceRate * 100) / 100,
          complaint_rate: Math.round(complaintRate * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/campaigns/:id - Update campaign (only draft)
export async function PATCH(
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

    // Verify ownership and status
    const { data: existing } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Can only update draft campaigns' }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = ['name', 'subject_override', 'body_override', 'input_payload', 'scheduled_at', 'from_name', 'from_email'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: campaign });
  } catch (error) {
    console.error('Update campaign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/campaigns/:id - Delete campaign
export async function DELETE(
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Cannot delete active campaigns
    if (['sending', 'queued'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot delete active campaigns' }, { status: 400 });
    }

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
