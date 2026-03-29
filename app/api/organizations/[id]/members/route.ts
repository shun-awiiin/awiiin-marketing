import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inviteMemberSchema } from "@/lib/types/organization";
import { sendEmail } from "@/lib/email/email-sender";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]/members - List organization members
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    // Check membership
    const { data: membership } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: members, error } = await serviceClient
      .from("organization_members")
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
      .eq("organization_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: members });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/members - Invite a member
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin/owner role
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Cannot invite as owner
    if (role === "owner") {
      return NextResponse.json(
        { error: "オーナー権限は付与できません" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Find user by email in users table
    const { data: targetUser } = await serviceClient
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    let userId: string;
    let isNewUser = false;

    if (targetUser) {
      userId = targetUser.id;
    } else {
      // User doesn't exist — create account via Admin API and send invite
      isNewUser = true;
      const tempPassword =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        "!A1";

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      const createRes = await fetch(
        supabaseUrl + "/auth/v1/admin/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            Authorization: "Bearer " + serviceKey,
          },
          body: JSON.stringify({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { invited_by: user.email },
          }),
        }
      );

      if (!createRes.ok) {
        const errBody = await createRes.json();
        return NextResponse.json(
          { error: errBody.msg || "アカウント作成に失敗しました" },
          { status: 500 }
        );
      }

      const newAuthUser = await createRes.json();
      userId = newAuthUser.id;

      // Create users table record
      await serviceClient.from("users").insert({
        id: userId,
        email,
        role: "editor",
        display_name: email.split("@")[0],
      });

      // Get org name for the invite email
      const { data: org } = await serviceClient
        .from("organizations")
        .select("name")
        .eq("id", id)
        .single();

      const orgName = org?.name || "組織";
      const loginUrl = "https://marketing.awiiin.com/auth/login";

      // Send invite email
      try {
        await sendEmail({
          to: email,
          subject: `【Awiiin Marketing】${orgName} に招待されました`,
          text: [
            `${user.email} さんから「${orgName}」への招待が届きました。`,
            "",
            "以下のリンクからログインしてください。",
            "",
            `ログインURL: ${loginUrl}`,
            `メールアドレス: ${email}`,
            `仮パスワード: ${tempPassword}`,
            "",
            "ログイン後、設定画面からパスワードを変更してください。",
            "",
            "---",
            "Awiiin Marketing",
          ].join("\n"),
          fromName: "Awiiin Marketing",
          fromEmail: process.env.SES_FROM_EMAIL || "info@m.awiiin.com",
        });
      } catch {
        // Email send failure is non-fatal
      }
    }

    // Check if already a member
    const { data: existing } = await serviceClient
      .from("organization_members")
      .select("id")
      .eq("organization_id", id)
      .eq("user_id", userId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "このユーザーは既にメンバーです" },
        { status: 409 }
      );
    }

    const { data: member, error: insertError } = await serviceClient
      .from("organization_members")
      .insert({
        organization_id: id,
        user_id: userId,
        role,
      })
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

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: member,
        message: isNewUser
          ? "アカウントを作成し、招待メールを送信しました"
          : "メンバーを追加しました",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
