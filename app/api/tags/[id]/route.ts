import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context';

// GET /api/tags/:id - Get single tag
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    const { data: tag, error } = await supabase
      .from('tags')
      .select('*')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single();

    if (error || !tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const { count } = await supabase
      .from('contact_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    return NextResponse.json({
      data: { ...tag, contact_count: count || 0 }
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/tags/:id - Update tag
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    const body = await request.json();
    const { name, color } = body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (name) {
      const { data: duplicate } = await supabase
        .from('tags')
        .select('id')
        .eq(filterCol, filterVal)
        .eq('name', name)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const { data: tag, error } = await supabase
      .from('tags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count } = await supabase
      .from('contact_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    return NextResponse.json({
      data: { ...tag, contact_count: count || 0 }
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tags/:id - Delete tag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq(filterCol, filterVal);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
