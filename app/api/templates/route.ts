import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context';
import type { TemplateType } from '@/lib/types/database';

// GET /api/templates - List templates
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as TemplateType | null;

    // Get presets and user/org's custom templates
    const userFilter = ctx.orgId
      ? `is_preset.eq.true,organization_id.eq.${ctx.orgId}`
      : `is_preset.eq.true,user_id.eq.${ctx.user.id}`;

    let query = supabase
      .from('templates')
      .select('*')
      .or(userFilter)
      .eq('is_active', true)
      .order('is_preset', { ascending: false })
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }

    const { data: templates, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: templates });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/templates - Create custom template
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const body = await request.json();
    const { name, type, subject_variants, body_text } = body;

    if (!name || !type || !body_text) {
      return NextResponse.json({ error: 'Name, type, and body_text are required' }, { status: 400 });
    }

    if (!['SEMINAR_INVITE', 'FREE_TRIAL_INVITE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid template type' }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        name,
        type,
        category: 'custom',
        subject_variants: subject_variants || [],
        body_text,
        is_preset: false,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
