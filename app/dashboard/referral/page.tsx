import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ReferralDashboardClient } from "@/components/referral/referral-dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "紹介プログラム管理",
};

async function ReferralDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: affiliates } = await supabase
    .from("affiliates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: pendingCommissions } = await supabase
    .from("commissions")
    .select(`
      *,
      affiliates (name, email),
      purchases (amount)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: recentPayouts } = await supabase
    .from("affiliate_payouts")
    .select(`
      *,
      affiliates (name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <ReferralDashboardClient
      affiliates={affiliates || []}
      pendingCommissions={pendingCommissions || []}
      recentPayouts={recentPayouts || []}
    />
  );
}

export default function ReferralPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">紹介プログラム</h1>
        <p className="text-muted-foreground">
          アフィリエイト管理・コミッション支払い
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
        <ReferralDashboard />
      </Suspense>
    </div>
  );
}
