import { createClient } from "@/lib/supabase/server";
import { TemplatesClient } from "@/components/templates/templates-client";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .or(`user_id.eq.${user.id},is_preset.eq.true`)
    .order("is_preset", { ascending: false })
    .order("name");

  return <TemplatesClient templates={templates ?? []} userId={user.id} />;
}
