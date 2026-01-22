import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getListHygieneStatus, calculateListHealthScore } from '@/lib/hygiene/list-hygiene';

// GET /api/list-hygiene/status - Get list hygiene status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getListHygieneStatus(user.id);
    const healthScore = calculateListHealthScore(status);

    return NextResponse.json({
      data: {
        ...status,
        health_score: healthScore,
      },
    });
  } catch (error) {
    console.error('List hygiene status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
