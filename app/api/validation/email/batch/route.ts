import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateEmailBatch } from '@/lib/validation/email-validator';
import { BatchValidationRequestSchema } from '@/lib/types/deliverability';

// POST /api/validation/email/batch - Validate multiple email addresses
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = BatchValidationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { emails, skip_mx_check } = parsed.data;

    // Limit batch size
    if (emails.length > 1000) {
      return NextResponse.json(
        { error: 'Batch size exceeds limit of 1000 emails' },
        { status: 400 }
      );
    }

    const result = await validateEmailBatch(emails, {
      skipMxCheck: skip_mx_check,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Batch validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
