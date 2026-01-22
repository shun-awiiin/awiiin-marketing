import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/rbac';

// GET /api/users - List all users (admin only)
export async function GET() {
  try {
    // RBAC check - admin only
    const user = await requireAuth('admin');
    if (!user) {
      const authCheck = await requireAuth();
      if (!authCheck) {
        return unauthorizedResponse();
      }
      return forbiddenResponse('Only admins can view users');
    }

    const supabase = await createClient();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role, display_name, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
