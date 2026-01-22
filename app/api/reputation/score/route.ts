import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateDeliverabilityScore, getDeliverabilityDashboardData } from '@/lib/deliverability/deliverability-score';

// GET /api/reputation/score - Get deliverability score
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const fullDashboard = searchParams.get('full') === 'true';

    if (fullDashboard) {
      const dashboardData = await getDeliverabilityDashboardData(user.id, domain || undefined);
      return NextResponse.json({ data: dashboardData });
    }

    const score = await calculateDeliverabilityScore(user.id, domain || undefined);

    return NextResponse.json({ data: score });
  } catch (error) {
    console.error('Deliverability score error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
