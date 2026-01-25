import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LPRenderer } from "@/components/lp/lp-renderer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: lp } = await supabase
    .from("landing_pages")
    .select("title, meta_description, og_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!lp) {
    return { title: "ページが見つかりません" };
  }

  return {
    title: lp.title,
    description: lp.meta_description,
    openGraph: {
      title: lp.title,
      description: lp.meta_description,
      images: lp.og_image_url ? [lp.og_image_url] : [],
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: lp, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !lp) {
    notFound();
  }

  // Increment view count (don't await to not block rendering)
  supabase
    .from("landing_pages")
    .update({ view_count: lp.view_count + 1 })
    .eq("id", lp.id)
    .then(() => {});

  return <LPRenderer landingPage={lp} />;
}
