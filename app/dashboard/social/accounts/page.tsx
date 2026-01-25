import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, ArrowLeft } from "lucide-react"
import { AccountList } from "@/components/social/account-list"

export const metadata = {
  title: "アカウント管理 | SNS投稿 | MailFlow",
  description: "SNSアカウント管理",
}

function AccountsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function SocialAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/social">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">アカウント管理</h1>
          <p className="text-muted-foreground">
            接続されているSNSアカウントを管理
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/social/connect">
            <Plus className="mr-2 size-4" />
            アカウント追加
          </Link>
        </Button>
      </div>

      <Suspense fallback={<AccountsLoading />}>
        <AccountList />
      </Suspense>
    </div>
  )
}
