import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReputationMetrics, getReputationSummary } from '@/lib/reputation/reputation-tracker';

// GET /api/reputation/metrics - Get reputation metrics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const period = searchParams.get('period') as '7d' | '30d' | '90d' | null;

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const metrics = await getReputationMetrics(user.id, domain || undefined, days);

    // If domain specified, get summary
    let summary = null;
    if (domain) {
      summary = await getReputationSummary(user.id, domain, period || '30d');
    }

    return NextResponse.json({
      data: {
        metrics,
        summary,
      },
    });
  } catch (error) {
    console.error('Reputation metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
