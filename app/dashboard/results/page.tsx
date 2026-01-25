import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ResultsDashboardClient } from "@/components/results/results-dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "結果分析",
};

async function ResultsDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch funnel stats
  const { data: funnels } = await supabase
    .from("funnels")
    .select(`
      *,
      funnel_steps (*)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch recent conversions
  const { data: conversions } = await supabase
    .from("conversion_events")
    .select(`
      *,
      visitors (visitor_id, first_seen_at)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch daily stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: dailyStats } = await supabase
    .from("funnel_daily_stats")
    .select("*")
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  // Fetch tracking links performance
  const { data: trackingLinks } = await supabase
    .from("tracking_links")
    .select("*")
    .eq("user_id", user.id)
    .order("total_clicks", { ascending: false })
    .limit(10);

  // Calculate summary stats
  const totalRevenue = conversions
    ?.filter((c) => c.event_type === "purchase")
    .reduce((sum, c) => sum + (c.revenue || 0), 0) || 0;

  const totalConversions = conversions?.filter((c) => c.event_type === "purchase").length || 0;

  return (
    <ResultsDashboardClient
      funnels={funnels || []}
      conversions={conversions || []}
      dailyStats={dailyStats || []}
      trackingLinks={trackingLinks || []}
      summary={{
        totalRevenue,
        totalConversions,
        avgOrderValue: totalConversions > 0 ? totalRevenue / totalConversions : 0,
      }}
    />
  );
}

export default function ResultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">結果分析</h1>
        <p className="text-muted-foreground">
          コンバージョン・売上・ファネルの成果を分析
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <ResultsDashboard />
      </Suspense>
    </div>
  );
}
