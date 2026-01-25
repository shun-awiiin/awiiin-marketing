import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThankYouRenderer } from "@/components/thank-you/thank-you-renderer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("thank_you_pages")
    .select("title")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!page) {
    return { title: "ページが見つかりません" };
  }

  return {
    title: page.title,
    robots: { index: false, follow: false },
  };
}

export default async function ThankYouPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page, error } = await supabase
    .from("thank_you_pages")
    .select(`
      *,
      products (name, description)
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !page) {
    notFound();
  }

  // Increment view count
  supabase
    .from("thank_you_pages")
    .update({ view_count: page.view_count + 1 })
    .eq("id", page.id)
    .then(() => {});

  return <ThankYouRenderer page={page} />;
}
