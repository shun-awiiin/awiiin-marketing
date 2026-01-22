import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      `
      *,
      templates(name, subject, body_text)
    `
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!campaign) {
    notFound();
  }

  const [messagesResult, statsResult] = await Promise.all([
    supabase
      .from("messages")
      .select(
        `
        *,
        contacts(email, name)
      `
      )
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("messages").select("status").eq("campaign_id", id),
  ]);

  const stats = {
    total: statsResult.data?.length ?? 0,
    pending: statsResult.data?.filter((m) => m.status === "pending").length ?? 0,
    sent: statsResult.data?.filter((m) => m.status === "sent").length ?? 0,
    failed: statsResult.data?.filter((m) => m.status === "failed").length ?? 0,
    bounced: statsResult.data?.filter((m) => m.status === "bounced").length ?? 0,
  };

  return (
    <CampaignDetail
      campaign={campaign}
      messages={messagesResult.data ?? []}
      stats={stats}
    />
  );
}
