import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getContactEngagements,
  getEngagementSummary,
} from '@/lib/engagement/engagement-tracker';
import type { EngagementLevel } from '@/lib/types/deliverability';

// GET /api/engagement/contacts - Get contact engagement data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') as EngagementLevel | null;
    const minScore = searchParams.get('min_score');
    const maxScore = searchParams.get('max_score');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const [contacts, summary] = await Promise.all([
      getContactEngagements(user.id, {
        level: level || undefined,
        minScore: minScore ? parseInt(minScore, 10) : undefined,
        maxScore: maxScore ? parseInt(maxScore, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      }),
      getEngagementSummary(user.id),
    ]);

    return NextResponse.json({
      data: {
        contacts,
        summary,
      },
    });
  } catch (error) {
    console.error('Engagement data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
