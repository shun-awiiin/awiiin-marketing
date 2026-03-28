import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { FormList } from "@/components/forms/form-list"
import type { StandaloneForm } from "@/lib/types/forms"

export default async function FormsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from("standalone_forms")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const forms = (data ?? []) as StandaloneForm[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">フォーム</h1>
          <p className="text-muted-foreground">
            リード獲得用のフォームを作成・管理します。
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/forms/new">
            <Plus className="mr-2 size-4" />
            新規作成
          </Link>
        </Button>
      </div>
      <FormList forms={forms} />
    </div>
  )
}
