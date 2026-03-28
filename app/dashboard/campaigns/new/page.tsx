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

  // Fetch segments separately to handle table not existing
  let segmentsData: Array<{ id: string; name: string; description: string | null; contact_count: number }> = [];
  try {
    const { data } = await supabase
      .from("segments")
      .select("id, name, description, contact_count")
      .eq("user_id", user.id)
      .order("name");
    segmentsData = data ?? [];
  } catch {
    segmentsData = [];
  }

  // Fetch lists separately to handle table not existing
  let listsData: Array<{ id: string; name: string; description: string | null; color: string; contact_count: number }> = [];
  try {
    const { data } = await supabase
      .from("lists")
      .select("id, name, description, color, contact_count")
      .eq("user_id", user.id)
      .order("name");
    listsData = data ?? [];
  } catch {
    listsData = [];
  }

  return (
    <CampaignWizard
      templates={templatesResult.data ?? []}
      tags={tagsResult.data ?? []}
      segments={segmentsData}
      lists={listsData}
      totalActiveContacts={contactCountResult.count ?? 0}
      userId={user.id}
    />
  );
}
