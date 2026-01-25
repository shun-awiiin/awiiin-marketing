import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LPDetailClient } from "@/components/lp/lp-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  params: Promise<{ id: string }>;
}

async function LPDetail({ id }: { id: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: landingPage, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !landingPage) {
    notFound();
  }

  return <LPDetailClient landingPage={landingPage} />;
}

export default async function LPDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-[600px] w-full" />
          </div>
        }
      >
        <LPDetail id={id} />
      </Suspense>
    </div>
  );
}
