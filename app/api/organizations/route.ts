import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/types/organization";

/**
 * GET /api/organizations - List organizations for current user
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service client to avoid RLS self-reference issues
    const serviceClient = await createServiceClient();

    const { data: memberships, error } = await serviceClient
      .from("organization_members")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details, hint: error.hint },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ data: [], debug: { userId: user.id } });
    }

    const orgIds = memberships.map((m) => m.organization_id);
    const { data: orgs, error: orgsError } = await serviceClient
      .from("organizations")
      .select("*")
      .in("id", orgIds);

    if (orgsError) {
      return NextResponse.json({ error: orgsError.message }, { status: 500 });
    }

    const orgMap = new Map((orgs || []).map((o) => [o.id, o]));
    const organizations = memberships
      .map((m) => {
        const org = orgMap.get(m.organization_id);
        if (!org) return null;
        return { ...org, membership: { role: m.role } };
      })
      .filter(Boolean);

    return NextResponse.json({ data: organizations });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations - Create a new organization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, slug, icon_url } = parsed.data;

    // Use service client to bypass RLS for creation
    const serviceClient = await createServiceClient();

    // Create organization
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert({
        name,
        slug,
        icon_url: icon_url ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (orgError) {
      if (orgError.code === "23505") {
        return NextResponse.json(
          { error: "このスラッグは既に使用されています" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    // Add creator as owner
    const { error: memberError } = await serviceClient
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: org }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
