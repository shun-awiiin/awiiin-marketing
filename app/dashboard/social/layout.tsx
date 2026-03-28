import { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    template: "%s | SNS投稿 | Awiiin Marketing",
    default: "SNS投稿 | Awiiin Marketing",
  },
  description: "SNS投稿管理",
}

export default function SocialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
