import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { SocialAnalytics } from "@/components/social/social-analytics"

export const metadata = {
  title: "分析 | SNS投稿",
}

export default async function SocialAnalyticsPage() {
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
          <h1 className="text-2xl font-bold">分析</h1>
          <p className="text-muted-foreground">
            SNS投稿のパフォーマンスを分析
          </p>
        </div>
      </div>

      <SocialAnalytics />
    </div>
  )
}
