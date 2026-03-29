import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context';

// GET /api/tags - List all tags
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .eq(filterCol, filterVal)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get contact counts for each tag
    const tagsWithCounts = await Promise.all(
      (tags || []).map(async (tag) => {
        const { count } = await supabase
          .from('contact_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tag.id);

        return {
          ...tag,
          contact_count: count || 0
        };
      })
    );

    return NextResponse.json({ data: tagsWithCounts });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tags - Create tag
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq(filterCol, filterVal)
      .eq('name', name)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
    }

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        name,
        color: color || '#6B7280'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { ...tag, contact_count: 0 } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
