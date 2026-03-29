'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Calendar,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { CalendarConnectionStatus } from '@/lib/types/calendar'

// ============================================
// TYPES
// ============================================

interface CalendarSettingsProps {
  initialStatus?: CalendarConnectionStatus | null
  successMessage?: string | null
  errorMessage?: string | null
}

// ============================================
// COMPONENT
// ============================================

export function CalendarSettings({
  initialStatus,
  successMessage,
  errorMessage,
}: CalendarSettingsProps) {
  const [status, setStatus] = useState<CalendarConnectionStatus | null>(
    initialStatus || null
  )
  const [loading, setLoading] = useState(!initialStatus)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/connection')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // Keep current status
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialStatus) {
      fetchStatus()
    }
  }, [initialStatus, fetchStatus])

  const handleConnect = () => {
    window.location.href = '/api/calendar/auth'
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/calendar/connection', { method: 'DELETE' })
      if (res.ok) {
        setStatus({
          connected: false,
          google_email: null,
          sync_enabled: false,
          last_synced_at: null,
          calendar_id: 'primary',
        })
      }
    } catch {
      // Keep current status
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSyncToggle = async (enabled: boolean) => {
    if (!status) return

    try {
      const res = await fetch('/api/calendar/connection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sync_enabled: enabled,
          calendar_id: status.calendar_id,
        }),
      })
      if (res.ok) {
        setStatus((prev) => (prev ? { ...prev, sync_enabled: enabled } : null))
      }
    } catch {
      // Revert on error
    }
  }

  const handleManualSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })
      const data = await res.json()
      if (res.ok) {
        setSyncResult(
          `${data.synced}件のイベントを同期しました（${data.matched}件のコンタクトと一致）`
        )
        fetchStatus()
      } else {
        setSyncResult(`エラー: ${data.error}`)
      }
    } catch {
      setSyncResult('同期に失敗しました')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}

      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Googleカレンダー連携
          </CardTitle>
          <CardDescription>
            Googleカレンダーと連携して、ミーティング情報をコンタクトに自動的に紐付けます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1.5 border-green-300 text-green-700">
                    <Link2 className="h-3 w-3" />
                    接続済み
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {status.google_email}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="gap-1.5 text-red-600 hover:text-red-700"
                >
                  {disconnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  接続解除
                </Button>
              </div>

              <Separator />

              {/* Sync settings */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">自動同期</p>
                  <p className="text-xs text-muted-foreground">
                    15分ごとにカレンダーイベントを自動的に同期します
                  </p>
                </div>
                <Switch
                  checked={status.sync_enabled}
                  onCheckedChange={handleSyncToggle}
                />
              </div>

              <Separator />

              {/* Manual sync */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">手動同期</p>
                  <p className="text-xs text-muted-foreground">
                    {status.last_synced_at
                      ? `最終同期: ${formatDistanceToNow(new Date(status.last_synced_at), {
                          addSuffix: true,
                          locale: ja,
                        })}`
                      : '未同期'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="gap-1.5"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  今すぐ同期
                </Button>
              </div>

              {syncResult && (
                <p className="text-sm text-muted-foreground">{syncResult}</p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-full bg-muted p-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Googleカレンダーが接続されていません
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  接続すると、ミーティング情報がコンタクトのタイムラインに自動的に表示されます
                </p>
              </div>
              <Button onClick={handleConnect} className="gap-2">
                <Link2 className="h-4 w-4" />
                Googleカレンダーを接続する
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
