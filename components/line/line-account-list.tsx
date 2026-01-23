'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Trash2, MessageSquare, Send } from 'lucide-react'
import type { LineAccountPublic } from '@/lib/types/l-step'

interface Props {
  accounts: LineAccountPublic[]
  onDisconnect?: (id: string) => void
  onTestMessage?: (id: string) => void
  emptyState?: React.ReactNode
}

export function LineAccountList({
  accounts,
  onDisconnect,
  onTestMessage,
  emptyState
}: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDisconnect = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/line/accounts/${deleteId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        onDisconnect?.(deleteId)
      }
    } catch {
      // Handle error silently
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>連携済みアカウント</CardTitle>
          <CardDescription>LINE公式アカウントとの連携状況</CardDescription>
        </CardHeader>
        <CardContent>
          {emptyState || (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                連携済みのLINEアカウントはありません
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                下のフォームから新規連携を行ってください
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>連携済みアカウント</CardTitle>
          <CardDescription>
            {accounts.length}件のLINE公式アカウントが連携されています
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>アカウント名</TableHead>
                <TableHead>Bot ID</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>連携日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    {account.display_name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {account.bot_basic_id ? (
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        @{account.bot_basic_id}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={account.status === 'active' ? 'default' : 'secondary'}
                    >
                      {account.status === 'active' ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(account.created_at).toLocaleDateString('ja-JP')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onTestMessage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onTestMessage(account.id)}
                          title="テストメッセージ送信"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(account.id)}
                        title="連携解除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>連携を解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このLINEアカウントとの連携を解除します。
              紐付けられているコンタクトへのLINEメッセージ送信ができなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '解除中...' : '連携解除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
