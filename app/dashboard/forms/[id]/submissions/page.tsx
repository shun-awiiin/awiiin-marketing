import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { SubmissionList } from "@/components/forms/submission-list"
import type { StandaloneForm, StandaloneFormSubmission } from "@/lib/types/forms"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function SubmissionsPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: form } = await supabase
    .from("standalone_forms")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!form) redirect("/dashboard/forms")

  const { data: submissions } = await supabase
    .from("standalone_form_submissions")
    .select("*")
    .eq("form_id", id)
    .order("submitted_at", { ascending: false })
    .limit(100)

  const typedForm = form as StandaloneForm
  const typedSubmissions = (submissions ?? []) as StandaloneFormSubmission[]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/forms/${id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            送信一覧 - {typedForm.name}
          </h1>
          <p className="text-muted-foreground">
            {typedSubmissions.length} 件の送信データ
          </p>
        </div>
      </div>
      <SubmissionList form={typedForm} submissions={typedSubmissions} />
    </div>
  )
}
