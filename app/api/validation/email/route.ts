import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateEmail } from '@/lib/validation/email-validator';
import { EmailValidationRequestSchema } from '@/lib/types/deliverability';

// POST /api/validation/email - Validate a single email address
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = EmailValidationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { email, skip_mx_check } = parsed.data;

    const result = await validateEmail(email, {
      skipMxCheck: skip_mx_check,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
