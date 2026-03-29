'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Play, Pause, Trash2, GitBranch, Users } from 'lucide-react'
import type { ScenarioStatus } from '@/lib/types/l-step'
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

interface ScenarioWithStats {
  id: string
  name: string
  description: string | null
  status: ScenarioStatus
  trigger_type: string
  created_at: string
  step_count: number
  stats: {
    total_enrolled: number
    active_count: number
    completed_count: number
  }
}

interface Props {
  scenarios: ScenarioWithStats[]
}

const statusLabels: Record<ScenarioStatus, string> = {
  draft: '下書き',
  active: '有効',
  paused: '一時停止',
  archived: 'アーカイブ'
}

const statusColors: Record<ScenarioStatus, string> = {
  draft: 'secondary',
  active: 'default',
  paused: 'outline',
  archived: 'secondary'
}

const triggerLabels: Record<string, string> = {
  manual: '手動',
  signup: '新規登録',
  tag_added: 'タグ追加',
  tag_removed: 'タグ削除',
  form_submit: 'フォーム送信'
}

export function ScenariosClient({ scenarios: initialScenarios }: Props) {
  const orgFetch = useOrgFetch();
  const [scenarios, setScenarios] = useState(initialScenarios)

  const handleStatusChange = async (id: string, newStatus: ScenarioStatus) => {
    try {
      const response = await orgFetch(`/api/scenarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const result = await response.json()

      if (result.success) {
        setScenarios(scenarios.map(s =>
          s.id === id ? { ...s, status: newStatus } : s
        ))
      }
    } catch {
      // Handle error silently
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このシナリオを削除しますか?')) return

    try {
      const response = await orgFetch(`/api/scenarios/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setScenarios(scenarios.filter(s => s.id !== id))
      }
    } catch {
      // Handle error silently
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">シナリオ</h1>
          <p className="text-muted-foreground">
            ステップメール・LINE配信の自動化シナリオを管理
          </p>
        </div>
        <Link href="/dashboard/scenarios/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Button>
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">シナリオがありません</h3>
            <p className="text-muted-foreground mb-4">
              最初のシナリオを作成して、メール・LINE配信を自動化しましょう
            </p>
            <Link href="/dashboard/scenarios/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                シナリオを作成
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>シナリオ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>シナリオ名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>トリガー</TableHead>
                  <TableHead className="text-center">ステップ数</TableHead>
                  <TableHead className="text-center">登録者</TableHead>
                  <TableHead className="text-center">完了</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/scenarios/${scenario.id}`}
                        className="font-medium hover:underline"
                      >
                        {scenario.name}
                      </Link>
                      {scenario.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {scenario.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[scenario.status] as 'default' | 'secondary' | 'outline'}>
                        {statusLabels[scenario.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {triggerLabels[scenario.trigger_type] || scenario.trigger_type}
                    </TableCell>
                    <TableCell className="text-center">
                      {scenario.step_count}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {scenario.stats.total_enrolled}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {scenario.stats.completed_count}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {scenario.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(scenario.id, 'active')}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              有効化
                            </DropdownMenuItem>
                          )}
                          {scenario.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(scenario.id, 'paused')}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              一時停止
                            </DropdownMenuItem>
                          )}
                          {scenario.status === 'paused' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(scenario.id, 'active')}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              再開
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(scenario.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
