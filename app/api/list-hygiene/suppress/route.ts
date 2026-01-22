import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { suppressContacts } from '@/lib/hygiene/list-hygiene';
import { SuppressRequestSchema } from '@/lib/types/deliverability';

// POST /api/list-hygiene/suppress - Suppress contacts based on criteria
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = SuppressRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const result = await suppressContacts(user.id, parsed.data);

    return NextResponse.json({
      data: result,
      dry_run: parsed.data.dry_run ?? true,
    });
  } catch (error) {
    console.error('Suppress contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
