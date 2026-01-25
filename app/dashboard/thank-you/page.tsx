import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ThankYouListClient } from "@/components/thank-you/thank-you-list-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "サンクスページ管理",
};

async function ThankYouList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: thankYouPages } = await supabase
    .from("thank_you_pages")
    .select(`
      *,
      products (name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <ThankYouListClient thankYouPages={thankYouPages || []} />;
}

export default function ThankYouPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">サンクスページ</h1>
        <p className="text-muted-foreground">
          購入後の案内ページを作成・管理
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
        <ThankYouList />
      </Suspense>
    </div>
  );
}
