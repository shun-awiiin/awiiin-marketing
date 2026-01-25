import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LPListClient } from "@/components/lp/lp-list-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "ランディングページ管理",
};

async function LPList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: landingPages } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <LPListClient landingPages={landingPages || []} />;
}

export default function LPPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ランディングページ</h1>
        <p className="text-muted-foreground">
          AIでLPを自動生成し、コンバージョンを最大化
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <LPList />
      </Suspense>
    </div>
  );
}
