import { createClient } from "@/lib/supabase/server";
import { ContactsClient } from "@/components/contacts/contacts-client";

const PAGE_SIZE = 100;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const currentPage = Math.max(1, Number(searchParams?.page || 1));
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const [contactsResult, tagsResult, countResult] = await Promise.all([
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
      .range(start, end)
      .order("created_at", { ascending: false }),
    supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
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
      totalCount={countResult.count ?? 0}
      currentPage={currentPage}
      pageSize={PAGE_SIZE}
    />
  );
}
