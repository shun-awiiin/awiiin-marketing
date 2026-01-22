import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkDomainHealth,
  saveDomainHealth,
} from '@/lib/domain/domain-health';
import { DomainHealthCheckRequestSchema } from '@/lib/types/deliverability';

// POST /api/domain-health/check - Check domain health and save result
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = DomainHealthCheckRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { domain, dkim_selector } = parsed.data;

    // Perform health check
    const checkResult = await checkDomainHealth(domain, dkim_selector);

    // Save result
    const savedRecord = await saveDomainHealth(user.id, checkResult);

    return NextResponse.json({
      data: {
        check_result: checkResult,
        saved_record: savedRecord,
      },
    });
  } catch (error) {
    console.error('Domain health check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
