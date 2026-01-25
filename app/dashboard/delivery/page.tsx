import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DeliveryDashboardClient } from "@/components/delivery/delivery-dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "配信管理",
};

async function DeliveryDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch active campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["draft", "scheduled", "sending"])
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch active scenarios
  const { data: scenarios } = await supabase
    .from("scenarios")
    .select(`
      *,
      scenario_steps (id),
      scenario_enrollments (id, status)
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch LINE broadcasts
  const { data: lineBroadcasts } = await supabase
    .from("line_broadcasts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <DeliveryDashboardClient
      campaigns={campaigns || []}
      scenarios={scenarios || []}
      lineBroadcasts={lineBroadcasts || []}
    />
  );
}

export default function DeliveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">配信管理</h1>
        <p className="text-muted-foreground">
          メール・LINE配信の一元管理
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
        <DeliveryDashboard />
      </Suspense>
    </div>
  );
}
