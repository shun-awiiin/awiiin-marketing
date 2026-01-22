import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/campaigns/:id/pause - Pause campaign
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

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check status
    if (!['queued', 'sending'].includes(campaign.status)) {
      return NextResponse.json({
        error: 'Campaign is not in a pausable state'
      }, { status: 400 });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Get stats
    const { data: messages } = await supabase
      .from('messages')
      .select('status')
      .eq('campaign_id', id);

    const sent = messages?.filter(m =>
      ['sent', 'delivered', 'bounced', 'complained'].includes(m.status)
    ).length || 0;

    const remaining = messages?.filter(m =>
      ['queued', 'sending'].includes(m.status)
    ).length || 0;

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'campaign.pause',
      target_type: 'campaign',
      target_id: id,
      payload: { sent, remaining }
    });

    return NextResponse.json({
      data: {
        status: 'paused',
        sent,
        remaining
      }
    });
  } catch (error) {
    console.error('Pause error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
