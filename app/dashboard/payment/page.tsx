import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProductListClient } from "@/components/payment/product-list-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "決済・商品管理",
};

async function ProductList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: recentPurchases } = await supabase
    .from("purchases")
    .select(`
      *,
      products (name),
      customers (email)
    `)
    .eq("products.user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <ProductListClient
      products={products || []}
      recentPurchases={recentPurchases || []}
    />
  );
}

export default function PaymentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">決済・商品管理</h1>
        <p className="text-muted-foreground">
          商品を作成し、Stripe決済を設定
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
        <ProductList />
      </Suspense>
    </div>
  );
}
