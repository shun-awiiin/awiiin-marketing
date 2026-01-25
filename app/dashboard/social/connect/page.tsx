"use client"

import { useRouter } from "next/navigation"
import { ConnectionWizard } from "@/components/social/connection-wizard"

export default function SocialConnectPage() {
  const router = useRouter()

  return (
    <div className="max-w-3xl mx-auto">
      <ConnectionWizard onBack={() => router.push("/dashboard/social/accounts")} />
    </div>
  )
}
