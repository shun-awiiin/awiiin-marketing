import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDomainHealthRecords,
  getOverallDomainHealthScore,
} from '@/lib/domain/domain-health';

// GET /api/domain-health - Get all domain health records for user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const records = await getDomainHealthRecords(user.id);
    const overallScore = await getOverallDomainHealthScore(user.id);

    return NextResponse.json({
      data: {
        domains: records,
        overall_score: overallScore,
        total_domains: records.length,
      },
    });
  } catch (error) {
    console.error('Domain health error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
