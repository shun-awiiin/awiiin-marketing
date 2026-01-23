'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
import { LineAccountList } from './line-account-list'
import { LineConnectForm } from './line-connect-form'
import type { LineAccountPublic } from '@/lib/types/l-step'

interface Props {
  accounts: LineAccountPublic[]
}

export function LineSettingsClient({ accounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [isConnecting, setIsConnecting] = useState(false)
  const [testDialog, setTestDialog] = useState<{ accountId: string; open: boolean }>({
    accountId: '',
    open: false
  })
  const [testForm, setTestForm] = useState({ line_user_id: '', message: '' })
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/line`
    : '/api/webhooks/line'

  const handleAccountConnected = useCallback((account: LineAccountPublic) => {
    setAccounts(prev => [account, ...prev])
    setIsConnecting(false)
  }, [])

  const handleAccountDisconnected = useCallback((id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id))
  }, [])

  const handleTestMessage = useCallback((accountId: string) => {
    setTestDialog({ accountId, open: true })
    setTestForm({ line_user_id: '', message: '' })
    setTestResult(null)
  }, [])

  const sendTestMessage = async () => {
    if (!testForm.line_user_id || !testForm.message) return

    setTestLoading(true)
    setTestResult(null)

    try {
      const response = await fetch(`/api/line/accounts/${testDialog.accountId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testForm)
      })

      const result = await response.json()

      if (result.success) {
        setTestResult({ success: true, message: 'テストメッセージを送信しました' })
        setTestForm({ line_user_id: '', message: '' })
      } else {
        setTestResult({ success: false, message: result.error || '送信に失敗しました' })
      }
    } catch {
      setTestResult({ success: false, message: '送信に失敗しました' })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">LINE連携設定</h1>
        <p className="text-muted-foreground">
          LINE公式アカウントを連携して、LINEメッセージを送信できるようにします
        </p>
      </div>

      <div className="space-y-6">
        {/* Connected Accounts */}
        <div className="flex items-center justify-between mb-4">
          <div />
          <Dialog open={isConnecting} onOpenChange={setIsConnecting}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新規連携
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>LINE公式アカウントを連携</DialogTitle>
              </DialogHeader>
              <LineConnectForm
                onSuccess={handleAccountConnected}
              />
            </DialogContent>
          </Dialog>
        </div>

        <LineAccountList
          accounts={accounts}
          onDisconnect={handleAccountDisconnected}
          onTestMessage={handleTestMessage}
        />

        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook設定</CardTitle>
            <CardDescription>
              LINE DevelopersコンソールでこのURLをWebhook URLとして設定してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  >
                    コピー
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>設定手順:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>LINE Developersコンソールにログイン</li>
                  <li>対象のチャンネルを選択</li>
                  <li>Messaging API設定 &gt; Webhook設定</li>
                  <li>上記URLをWebhook URLに設定</li>
                  <li>Webhookの利用を「ON」に設定</li>
                </ol>
              </div>

              <Button variant="outline" asChild>
                <a
                  href="https://developers.line.biz/console/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LINE Developersコンソールを開く
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Message Dialog */}
      <Dialog
        open={testDialog.open}
        onOpenChange={(open) => setTestDialog({ ...testDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テストメッセージ送信</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="line_user_id">LINE User ID</Label>
              <Input
                id="line_user_id"
                value={testForm.line_user_id}
                onChange={(e) => setTestForm({ ...testForm, line_user_id: e.target.value })}
                placeholder="U1234567890abcdef..."
              />
              <p className="text-xs text-muted-foreground">
                送信先のLINE User ID（Uで始まる33文字）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test_message">メッセージ</Label>
              <Textarea
                id="test_message"
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                placeholder="テストメッセージを入力..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestDialog({ ...testDialog, open: false })}
            >
              キャンセル
            </Button>
            <Button
              onClick={sendTestMessage}
              disabled={testLoading || !testForm.line_user_id || !testForm.message}
            >
              {testLoading ? '送信中...' : '送信'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
