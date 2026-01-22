/**
 * Role-Based Access Control (RBAC) utilities
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { UserRole } from "@/lib/types/database";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Get the current authenticated user with their role
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  // Get user role from users table
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  return {
    id: authUser.id,
    email: authUser.email || "",
    role: (user?.role as UserRole) || "viewer",
  };
}

/**
 * Check if user has a specific role or higher
 * Role hierarchy: admin > editor > viewer
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user can perform an action
 */
export function canPerformAction(
  userRole: UserRole,
  action:
    | "view"
    | "create"
    | "edit"
    | "delete"
    | "send"
    | "pause"
    | "resume"
    | "stop"
    | "manage_users"
): boolean {
  const actionPermissions: Record<string, UserRole> = {
    view: "viewer",
    create: "editor",
    edit: "editor",
    delete: "editor",
    send: "editor",
    pause: "editor",
    resume: "admin",
    stop: "admin",
    manage_users: "admin",
  };

  const requiredRole = actionPermissions[action];
  return hasRole(userRole, requiredRole);
}

/**
 * Require authentication and optionally check role
 * Returns user if authorized, null otherwise
 */
export async function requireAuth(
  requiredRole?: UserRole
): Promise<AuthUser | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (requiredRole && !hasRole(user.role, requiredRole)) {
    return null;
  }

  return user;
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Log an audit event
 */
export async function logAuditEvent(params: {
  userId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const supabase = await createServiceClient();

    await supabase.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      payload: params.payload || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });
  } catch {
    // Silently fail - audit logging should not break the main flow
    console.error("Failed to log audit event");
  }
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(message?: string) {
  return Response.json(
    { error: message || "Unauthorized" },
    { status: 401 }
  );
}

/**
 * Helper to create forbidden response
 */
export function forbiddenResponse(message?: string) {
  return Response.json(
    { error: message || "Forbidden - insufficient permissions" },
    { status: 403 }
  );
}
