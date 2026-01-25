import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PostComposer } from "@/components/social/post-composer"

export const metadata = {
  title: "新規投稿 | SNS投稿",
}

export default async function NewPostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">新規投稿</h1>
        <p className="text-muted-foreground">
          複数のSNSに同時に投稿できます
        </p>
      </div>

      <PostComposer mode="create" />
    </div>
  )
}
