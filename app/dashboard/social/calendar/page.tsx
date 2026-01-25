import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus } from "lucide-react"
import { SocialCalendar } from "@/components/social/social-calendar"

export const metadata = {
  title: "カレンダー | SNS投稿",
}

export default async function SocialCalendarPage() {
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
          <h1 className="text-2xl font-bold">投稿カレンダー</h1>
          <p className="text-muted-foreground">
            予約投稿をカレンダーで管理
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/social/posts/new">
            <Plus className="mr-2 size-4" />
            新規投稿
          </Link>
        </Button>
      </div>

      <SocialCalendar />
    </div>
  )
}
