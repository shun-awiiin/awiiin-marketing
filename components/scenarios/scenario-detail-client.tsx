'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Play,
  Pause,
  Plus,
  Settings,
  Users,
  Mail,
  Clock,
  GitBranch,
  MessageSquare
} from 'lucide-react'
import { StepBuilder } from './step-builder'
import { EnrollmentList } from './enrollment-list'
import type { ScenarioWithSteps, ScenarioStep, ScenarioStatus } from '@/lib/types/l-step'

interface Props {
  scenario: ScenarioWithSteps & {
    stats: {
      total_enrolled: number
      active_count: number
      completed_count: number
      paused_count: number
      exited_count: number
    }
  }
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
}

const statusLabels: Record<ScenarioStatus, string> = {
  draft: '下書き',
  active: '有効',
  paused: '一時停止',
  archived: 'アーカイブ'
}

const stepTypeIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  wait: <Clock className="h-4 w-4" />,
  condition: <GitBranch className="h-4 w-4" />,
  line: <MessageSquare className="h-4 w-4" />,
  action: <Settings className="h-4 w-4" />
}

export function ScenarioDetailClient({ scenario: initialScenario, tags, customFields }: Props) {
  const router = useRouter()
  const [scenario, setScenario] = useState(initialScenario)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: ScenarioStatus) => {
    if (newStatus === 'active' && scenario.scenario_steps.length === 0) {
      alert('シナリオを有効化するには、少なくとも1つのステップが必要です')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const result = await response.json()

      if (result.success) {
        setScenario({ ...scenario, status: newStatus })
      } else {
        alert(result.error)
      }
    } catch {
      alert('更新に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStepsChange = (newSteps: ScenarioStep[]) => {
    setScenario({ ...scenario, scenario_steps: newSteps })
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link
          href="/dashboard/scenarios"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          シナリオ一覧に戻る
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{scenario.name}</h1>
            <Badge variant={scenario.status === 'active' ? 'default' : 'secondary'}>
              {statusLabels[scenario.status]}
            </Badge>
          </div>
          {scenario.description && (
            <p className="text-muted-foreground">{scenario.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {scenario.status === 'draft' && (
            <Button onClick={() => handleStatusChange('active')} disabled={isUpdating}>
              <Play className="h-4 w-4 mr-2" />
              有効化
            </Button>
          )}
          {scenario.status === 'active' && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange('paused')}
              disabled={isUpdating}
            >
              <Pause className="h-4 w-4 mr-2" />
              一時停止
            </Button>
          )}
          {scenario.status === 'paused' && (
            <Button onClick={() => handleStatusChange('active')} disabled={isUpdating}>
              <Play className="h-4 w-4 mr-2" />
              再開
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">登録者数</p>
                <p className="text-2xl font-bold">{scenario.stats.total_enrolled}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">実行中</p>
                <p className="text-2xl font-bold">{scenario.stats.active_count}</p>
              </div>
              <Play className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">完了</p>
                <p className="text-2xl font-bold">{scenario.stats.completed_count}</p>
              </div>
              <Badge className="bg-blue-500">完了</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ステップ数</p>
                <p className="text-2xl font-bold">{scenario.scenario_steps.length}</p>
              </div>
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps">ステップ</TabsTrigger>
          <TabsTrigger value="enrollments">登録者</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-6">
          <StepBuilder
            scenarioId={scenario.id}
            steps={scenario.scenario_steps}
            onStepsChange={handleStepsChange}
            tags={tags}
            customFields={customFields}
          />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-6">
          <EnrollmentList scenarioId={scenario.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>シナリオ設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">トリガー</label>
                  <p className="text-muted-foreground">
                    {scenario.trigger_type === 'manual' ? '手動登録' :
                     scenario.trigger_type === 'signup' ? '新規登録時' :
                     scenario.trigger_type === 'tag_added' ? 'タグ追加時' :
                     scenario.trigger_type === 'tag_removed' ? 'タグ削除時' :
                     'フォーム送信時'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">作成日</label>
                  <p className="text-muted-foreground">
                    {new Date(scenario.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
