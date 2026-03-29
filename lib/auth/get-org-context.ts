import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrgMemberRole } from "@/lib/types/organization";

export interface OrgContext {
  user: {
    id: string;
    email: string;
  };
  orgId: string | null;
  membership: {
    role: OrgMemberRole;
  } | null;
}

export interface OrgContextError {
  error: string;
  status: number;
}

/**
 * Gets the current user and their organization context from request headers.
 *
 * API routes should use this instead of just getting the user when they need
 * organization-scoped data access.
 *
 * The client sets X-Organization-Id header on requests.
 * If no header is present, finds the user's first organization automatically.
 * If user has no organization (legacy), returns orgId: null for backward compat.
 *
 * Uses service client for membership verification to bypass RLS.
 */
export async function getOrgContext(
  request: NextRequest
): Promise<OrgContext | OrgContextError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const serviceClient = await createServiceClient();
  let orgId = request.headers.get("X-Organization-Id");

  if (orgId) {
    // Verify user is a member of the specified organization
    const { data: membership } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { error: "Not a member of this organization", status: 403 };
    }

    return {
      user: { id: user.id, email: user.email || "" },
      orgId,
      membership: { role: membership.role as OrgMemberRole },
    };
  }

  // No header: find user's first organization automatically
  const { data: firstMembership } = await serviceClient
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (firstMembership) {
    return {
      user: { id: user.id, email: user.email || "" },
      orgId: firstMembership.organization_id,
      membership: { role: firstMembership.role as OrgMemberRole },
    };
  }

  // Legacy user with no organization — return null orgId for backward compat
  return {
    user: { id: user.id, email: user.email || "" },
    orgId: null,
    membership: null,
  };
}

/**
 * Type guard to check if result is an error
 */
export function isOrgContextError(
  result: OrgContext | OrgContextError
): result is OrgContextError {
  return "error" in result;
}
