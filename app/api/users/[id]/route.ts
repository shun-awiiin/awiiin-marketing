import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  logAuditEvent,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/rbac';
import { UserRole } from '@/lib/types/database';

// GET /api/users/:id - Get user details (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC check - admin only
    const user = await requireAuth('admin');
    if (!user) {
      const authCheck = await requireAuth();
      if (!authCheck) {
        return unauthorizedResponse();
      }
      return forbiddenResponse('Only admins can view user details');
    }

    const supabase = await createClient();

    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, email, role, display_name, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: targetUser });
  } catch (error) {
    console.error('User detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/users/:id - Update user role (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC check - admin only
    const user = await requireAuth('admin');
    if (!user) {
      const authCheck = await requireAuth();
      if (!authCheck) {
        return unauthorizedResponse();
      }
      return forbiddenResponse('Only admins can update user roles');
    }

    const body = await request.json();
    const { role } = body;

    // Validate role
    const validRoles: UserRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, editor, or viewer' },
        { status: 400 }
      );
    }

    // Prevent self-demotion
    if (id === user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot demote yourself' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user info
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', id)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousRole = targetUser.role;

    // Update role
    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log audit
    await logAuditEvent({
      userId: user.id,
      action: 'user.role_change',
      targetType: 'user',
      targetId: id,
      payload: {
        previousRole,
        newRole: role,
        targetEmail: targetUser.email,
      },
    });

    return NextResponse.json({
      data: {
        id,
        role,
        previousRole,
      },
    });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
