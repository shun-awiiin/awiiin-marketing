import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { EbayToolsClient } from '@/components/social/ebay-tools-client'

export const metadata: Metadata = {
  title: 'eBay SNS誘導ツール',
  description: 'eBayからSNSへの誘導テンプレートを生成',
}

export default function EbayToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/social">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">eBay SNS誘導ツール</h1>
          <p className="text-muted-foreground">
            eBayバイヤーをSNSフォロワーに変換するためのテンプレートを生成
          </p>
        </div>
      </div>

      <EbayToolsClient />
    </div>
  )
}
