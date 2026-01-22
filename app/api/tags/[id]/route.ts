import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tags/:id - Get single tag
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tag, error } = await supabase
      .from('tags')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Get contact count
    const { count } = await supabase
      .from('contact_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    return NextResponse.json({
      data: { ...tag, contact_count: count || 0 }
    });
  } catch (error) {
    console.error('Get tag error:', error);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color } = body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check for duplicate name
    if (name) {
      const { data: duplicate } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', user.id)
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

    // Get contact count
    const { count } = await supabase
      .from('contact_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    return NextResponse.json({
      data: { ...tag, contact_count: count || 0 }
    });
  } catch (error) {
    console.error('Update tag error:', error);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership and delete
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete tag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
