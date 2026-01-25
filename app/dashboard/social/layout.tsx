import { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    template: "%s | SNS投稿 | MailFlow",
    default: "SNS投稿 | MailFlow",
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
