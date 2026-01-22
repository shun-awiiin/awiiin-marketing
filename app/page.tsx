import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, Zap, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">MailFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">ログイン</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>無料で始める</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-balance">
            到達率最優先の
            <br />
            メール配信管理
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
            セミナー案内や無料登録案内に特化したシンプルなメール配信ツール。
            HubSpotの複雑さを排除し、本当に必要な機能だけを提供します。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="px-8">
                無料で始める
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="px-8 bg-transparent">
                ログイン
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold mb-12">主な機能</h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">到達率最優先</h3>
                <p className="text-muted-foreground">
                  スパム判定を避けるテンプレート設計と
                  安全な送信間隔で高い到達率を実現
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">シンプル操作</h3>
                <p className="text-muted-foreground">
                  複雑な設定は不要。テンプレートを選んで
                  送信先を指定するだけで配信開始
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">コンプライアンス対応</h3>
                <p className="text-muted-foreground">
                  ワンクリック配信停止とオプトアウト管理で
                  法令遵守を自動化
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>MailFlow - 到達率最優先のメール配信管理ツール</p>
        </div>
      </footer>
    </div>
  );
}
