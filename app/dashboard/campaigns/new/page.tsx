import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [templatesResult, tagsResult, contactCountResult] = await Promise.all([
    supabase
      .from("templates")
      .select("*")
      .or(`user_id.eq.${user.id},is_preset.eq.true`)
      .order("name"),
    supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  return (
    <CampaignWizard
      templates={templatesResult.data ?? []}
      tags={tagsResult.data ?? []}
      totalActiveContacts={contactCountResult.count ?? 0}
      userId={user.id}
    />
  );
}
