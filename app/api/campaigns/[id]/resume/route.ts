import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  logAuditEvent,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/rbac';

// POST /api/campaigns/:id/resume - Resume campaign (admin only)
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
      return forbiddenResponse('Only admins can resume campaigns');
    }

    const supabase = await createClient();

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('status, user_id')
      .eq('id', id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check status
    if (campaign.status !== 'paused') {
      return NextResponse.json({
        error: 'Campaign is not paused'
      }, { status: 400 });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        paused_at: null
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Get remaining count
    const { count: remaining } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .in('status', ['queued']);

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'campaign.resume',
      target_type: 'campaign',
      target_id: id,
      payload: { remaining }
    });

    // Trigger send process
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/campaigns/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: id })
    }).catch(err => console.error('Failed to trigger send:', err));

    return NextResponse.json({
      data: {
        status: 'sending',
        remaining: remaining || 0
      }
    });
  } catch (error) {
    console.error('Resume error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
