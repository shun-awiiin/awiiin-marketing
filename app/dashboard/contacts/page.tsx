import { createClient } from "@/lib/supabase/server";
import { ContactsClient } from "@/components/contacts/contacts-client";

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [contactsResult, tagsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        `
        *,
        contact_tags(
          tags(id, name, color)
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
  ]);

  const contacts =
    contactsResult.data?.map((contact) => ({
      ...contact,
      tags: contact.contact_tags?.map((ct: { tags: { id: string; name: string; color: string } }) => ct.tags) ?? [],
    })) ?? [];

  return (
    <ContactsClient
      initialContacts={contacts}
      tags={tagsResult.data ?? []}
      userId={user.id}
    />
  );
}
