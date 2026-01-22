import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  logAuditEvent,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/rbac';

// POST /api/campaigns/:id/stop - Stop campaign (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC check - admin only
    const user = await requireAuth('admin');
    if (!user) {
      const authCheck = await requireAuth();
      if (!authCheck) {
        return unauthorizedResponse();
      }
      return forbiddenResponse('Only admins can stop campaigns');
    }

    const supabase = await createClient();

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check status
    if (!['queued', 'sending', 'paused'].includes(campaign.status)) {
      return NextResponse.json({
        error: 'Campaign cannot be stopped'
      }, { status: 400 });
    }

    // Get current stats
    const { data: messages } = await supabase
      .from('messages')
      .select('status')
      .eq('campaign_id', id);

    const sent = messages?.filter(m =>
      ['sent', 'delivered', 'bounced', 'complained'].includes(m.status)
    ).length || 0;

    const queued = messages?.filter(m =>
      ['queued', 'sending'].includes(m.status)
    ).length || 0;

    // Update campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'stopped',
        stop_reason: 'Manually stopped by admin',
        completed_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Mark queued messages as failed
    await supabase
      .from('messages')
      .update({
        status: 'failed',
        last_error: 'Campaign stopped'
      })
      .eq('campaign_id', id)
      .in('status', ['queued', 'sending']);

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'campaign.stop',
      target_type: 'campaign',
      target_id: id,
      payload: { sent, cancelled: queued }
    });

    return NextResponse.json({
      data: {
        status: 'stopped',
        sent,
        cancelled: queued
      }
    });
  } catch (error) {
    console.error('Stop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
