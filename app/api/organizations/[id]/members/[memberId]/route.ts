import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMemberRoleSchema } from "@/lib/types/organization";

type RouteParams = { params: Promise<{ id: string; memberId: string }> };

/**
 * PATCH /api/organizations/[id]/members/[memberId] - Update member role
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin/owner role
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .single();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get target member
    const { data: targetMember } = await supabase
      .from("organization_members")
      .select("role, user_id")
      .eq("id", memberId)
      .eq("organization_id", id)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: "メンバーが見つかりません" },
        { status: 404 }
      );
    }

    // Cannot change owner's role
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "オーナーの権限は変更できません" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Cannot promote to owner
    if (parsed.data.role === "owner") {
      return NextResponse.json(
        { error: "オーナー権限は付与できません" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("organization_members")
      .update({ role: parsed.data.role })
      .eq("id", memberId)
      .eq("organization_id", id)
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        created_at,
        user:users(id, email, display_name)
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizations/[id]/members/[memberId] - Remove member
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin/owner role
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .single();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get target member
    const { data: targetMember } = await supabase
      .from("organization_members")
      .select("role, user_id")
      .eq("id", memberId)
      .eq("organization_id", id)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: "メンバーが見つかりません" },
        { status: 404 }
      );
    }

    // Cannot remove owner
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "オーナーは削除できません" },
        { status: 400 }
      );
    }

    // Cannot remove self (use leave instead)
    if (targetMember.user_id === user.id) {
      return NextResponse.json(
        { error: "自分自身は削除できません" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId)
      .eq("organization_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
