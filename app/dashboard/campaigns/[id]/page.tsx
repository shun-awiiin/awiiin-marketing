import { notFound, redirect } from "next/navigation";
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

  if (!user) {
    redirect("/auth/login");
  }

  // まずキャンペーンのみを取得
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (campaignError) {
    console.error("Campaign fetch error:", campaignError);
    notFound();
  }

  if (!campaign) {
    notFound();
  }

  // テンプレート情報を別途取得（オプショナル）
  let template = null;
  if (campaign.template_id) {
    const { data: templateData } = await supabase
      .from("templates")
      .select("name, subject, body_text")
      .eq("id", campaign.template_id)
      .single();
    template = templateData;
  }

  // リスト情報を取得
  let listInfo = null;
  if (campaign.list_id) {
    const { data } = await supabase
      .from("lists")
      .select("name, contact_count")
      .eq("id", campaign.list_id)
      .single();
    listInfo = data;
  }

  // セグメント情報を取得
  let segmentInfo = null;
  if (campaign.segment_id) {
    const { data } = await supabase
      .from("segments")
      .select("name, contact_count")
      .eq("id", campaign.segment_id)
      .single();
    segmentInfo = data;
  }

  // キャンペーンにテンプレート・宛先情報を追加
  const campaignWithTemplate = {
    ...campaign,
    templates: template,
    list_info: listInfo,
    segment_info: segmentInfo,
  };

  const [messagesResult, statsResult] = await Promise.all([
    supabase
      .from("messages")
      .select(
        `
        id,
        status,
        sent_at,
        created_at,
        to_email,
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
    pending: statsResult.data?.filter((m) => ["pending", "queued"].includes(m.status)).length ?? 0,
    sent: statsResult.data?.filter((m) => m.status === "sent").length ?? 0,
    failed: statsResult.data?.filter((m) => m.status === "failed").length ?? 0,
    bounced: statsResult.data?.filter((m) => m.status === "bounced").length ?? 0,
  };

  return (
    <CampaignDetail
      campaign={campaignWithTemplate}
      messages={messagesResult.data ?? []}
      stats={stats}
    />
  );
}
