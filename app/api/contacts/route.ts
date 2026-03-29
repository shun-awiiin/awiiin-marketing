import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrgContext, isOrgContextError } from '@/lib/auth/get-org-context';
import type { ContactStatus } from '@/lib/types/database';

// GET /api/contacts - List contacts with filtering
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ContactStatus | null;
    const tagId = searchParams.get('tag');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '50');
    const offset = (page - 1) * perPage;

    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    // Tag filter requires a subquery approach
    if (tagId) {
      const { data: contactIds } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .eq('tag_id', tagId);

      if (!contactIds || contactIds.length === 0) {
        return NextResponse.json({
          data: [],
          meta: { total: 0, page, per_page: perPage }
        });
      }

      let query = supabase
        .from('contacts')
        .select(`
          *,
          contact_tags!inner(tag_id),
          tags:contact_tags(tags(*))
        `, { count: 'exact' })
        .eq(filterCol, filterVal)
        .in('id', contactIds.map(c => c.contact_id))
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1);

      if (status) {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,company.ilike.%${search}%`);
      }

      const { data: contacts, count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        data: contacts || [],
        meta: { total: count || 0, page, per_page: perPage }
      });
    }

    // Fetch without tag filter
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq(filterCol, filterVal)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,company.ilike.%${search}%`);
    }

    const { data: contacts, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch tags for each contact
    const contactIds = contacts?.map(c => c.id) || [];
    let contactsWithTags = contacts || [];

    if (contactIds.length > 0) {
      const { data: contactTags } = await supabase
        .from('contact_tags')
        .select(`
          contact_id,
          tags(*)
        `)
        .in('contact_id', contactIds);

      const tagsByContact = new Map<string, typeof contactTags>();
      contactTags?.forEach(ct => {
        const existing = tagsByContact.get(ct.contact_id) || [];
        tagsByContact.set(ct.contact_id, [...existing, ct]);
      });

      contactsWithTags = contacts?.map(contact => ({
        ...contact,
        tags: (tagsByContact.get(contact.id) || []).map(ct => ct.tags).filter(Boolean)
      })) || [];
    }

    return NextResponse.json({
      data: contactsWithTags,
      meta: {
        total: count || 0,
        page,
        per_page: perPage
      }
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/contacts - Create single contact
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext(request);
    if (isOrgContextError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const supabase = await createServiceClient();
    const body = await request.json();
    const { email, first_name, company, tag_ids } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const filterCol = ctx.orgId ? 'organization_id' : 'user_id';
    const filterVal = ctx.orgId || ctx.user.id;

    // Check for duplicate
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq(filterCol, filterVal)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Contact with this email already exists' }, { status: 409 });
    }

    // Insert contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: ctx.user.id,
        organization_id: ctx.orgId,
        email: email.toLowerCase(),
        first_name: first_name || null,
        company: company || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add tags if provided
    if (tag_ids && tag_ids.length > 0) {
      const tagInserts = tag_ids.map((tagId: string) => ({
        contact_id: contact.id,
        tag_id: tagId
      }));
      await supabase.from('contact_tags').insert(tagInserts);
    }

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
