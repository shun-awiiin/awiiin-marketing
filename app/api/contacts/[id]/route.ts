import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context';

// GET /api/contacts/:id - Get single contact
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

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single();

    if (error || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Fetch tags
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('tags(*)')
      .eq('contact_id', id);

    const tags = contactTags?.map(ct => ct.tags).filter(Boolean) || [];

    return NextResponse.json({
      data: { ...contact, tags }
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/contacts/:id - Update contact
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
    const { first_name, company, status, tag_ids } = body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq(filterCol, filterVal)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Update contact
    const updateData: Record<string, unknown> = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (company !== undefined) updateData.company = company;
    if (status !== undefined) updateData.status = status;

    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update tags if provided
    if (tag_ids !== undefined) {
      await supabase.from('contact_tags').delete().eq('contact_id', id);
      if (tag_ids.length > 0) {
        const tagInserts = tag_ids.map((tagId: string) => ({
          contact_id: id,
          tag_id: tagId
        }));
        await supabase.from('contact_tags').insert(tagInserts);
      }
    }

    // Fetch updated tags
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('tags(*)')
      .eq('contact_id', id);

    const tags = contactTags?.map(ct => ct.tags).filter(Boolean) || [];

    return NextResponse.json({
      data: { ...contact, tags }
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/contacts/:id - Delete contact
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
      .from('contacts')
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
