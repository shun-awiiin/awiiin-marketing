import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const OrgMemberRoles = ["owner", "admin", "member", "viewer"] as const;
export type OrgMemberRole = (typeof OrgMemberRoles)[number];

// ============================================
// DATABASE TYPES
// ============================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;
  created_at: string;
}

/**
 * Organization with membership info for the current user
 */
export interface OrganizationWithRole extends Organization {
  membership: {
    role: OrgMemberRole;
  };
}

/**
 * Organization member with user details (joined)
 */
export interface OrganizationMemberWithUser extends OrganizationMember {
  user: {
    id: string;
    email: string;
    display_name: string | null;
  };
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const orgMemberRoleSchema = z.enum(OrgMemberRoles);

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "組織名は必須です")
    .max(255, "組織名は255文字以内にしてください"),
  slug: z
    .string()
    .min(1, "スラッグは必須です")
    .max(100, "スラッグは100文字以内にしてください")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "スラッグは英小文字、数字、ハイフンのみ使用できます"
    ),
  icon_url: z.string().url("有効なURLを入力してください").nullable().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "組織名は必須です")
    .max(255, "組織名は255文字以内にしてください")
    .optional(),
  slug: z
    .string()
    .min(1, "スラッグは必須です")
    .max(100, "スラッグは100文字以内にしてください")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "スラッグは英小文字、数字、ハイフンのみ使用できます"
    )
    .optional(),
  icon_url: z.string().url("有効なURLを入力してください").nullable().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  role: orgMemberRoleSchema.default("member"),
});

export const updateMemberRoleSchema = z.object({
  role: orgMemberRoleSchema,
});

// ============================================
// TYPE INFERENCES
// ============================================

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// ============================================
// HELPERS
// ============================================

const roleHierarchy: Record<OrgMemberRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function hasOrgRole(
  userRole: OrgMemberRole,
  requiredRole: OrgMemberRole
): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function getOrgRoleLabel(role: OrgMemberRole): string {
  const labels: Record<OrgMemberRole, string> = {
    owner: "オーナー",
    admin: "管理者",
    member: "メンバー",
    viewer: "閲覧者",
  };
  return labels[role];
}
