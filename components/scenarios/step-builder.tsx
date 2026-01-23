'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus,
  Mail,
  Clock,
  GitBranch,
  MessageSquare,
  Settings,
  Trash2,
  ChevronDown
} from 'lucide-react'
import type { ScenarioStep, StepType } from '@/lib/types/l-step'

interface Props {
  scenarioId: string
  steps: ScenarioStep[]
  onStepsChange: (steps: ScenarioStep[]) => void
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
}

const stepTypeLabels: Record<StepType, string> = {
  email: 'メール送信',
  wait: '待機',
  condition: '条件分岐',
  line: 'LINE送信',
  action: 'アクション'
}

const stepTypeIcons: Record<StepType, React.ReactNode> = {
  email: <Mail className="h-5 w-5" />,
  wait: <Clock className="h-5 w-5" />,
  condition: <GitBranch className="h-5 w-5" />,
  line: <MessageSquare className="h-5 w-5" />,
  action: <Settings className="h-5 w-5" />
}

export function StepBuilder({ scenarioId, steps, onStepsChange, tags, customFields }: Props) {
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [editingStep, setEditingStep] = useState<ScenarioStep | null>(null)
  const [newStepType, setNewStepType] = useState<StepType>('email')
  const [stepConfig, setStepConfig] = useState<Record<string, unknown>>({})
  const [stepName, setStepName] = useState('')

  const handleAddStep = async () => {
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_type: newStepType,
          name: stepName || stepTypeLabels[newStepType],
          config: stepConfig
        })
      })

      const result = await response.json()

      if (result.success) {
        onStepsChange([...steps, result.data])
        setIsAddingStep(false)
        setStepConfig({})
        setStepName('')
      } else {
        alert(result.error)
      }
    } catch {
      alert('ステップの追加に失敗しました')
    }
  }

  const handleUpdateStep = async () => {
    if (!editingStep) return

    try {
      const response = await fetch(
        `/api/scenarios/${scenarioId}/steps/${editingStep.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: stepName,
            config: stepConfig
          })
        }
      )

      const result = await response.json()

      if (result.success) {
        onStepsChange(steps.map(s => s.id === editingStep.id ? result.data : s))
        setEditingStep(null)
        setStepConfig({})
        setStepName('')
      } else {
        alert(result.error)
      }
    } catch {
      alert('ステップの更新に失敗しました')
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('このステップを削除しますか?')) return

    try {
      const response = await fetch(
        `/api/scenarios/${scenarioId}/steps/${stepId}`,
        { method: 'DELETE' }
      )

      const result = await response.json()

      if (result.success) {
        onStepsChange(steps.filter(s => s.id !== stepId))
      } else {
        alert(result.error)
      }
    } catch {
      alert('ステップの削除に失敗しました')
    }
  }

  const startEditing = (step: ScenarioStep) => {
    setEditingStep(step)
    setStepName(step.name || '')
    setStepConfig(step.config || {})
  }

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">ステップがありません</h3>
            <p className="text-muted-foreground mb-4">
              最初のステップを追加して、シナリオを構築しましょう
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.id}>
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => startEditing(step)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      {stepTypeIcons[step.step_type]}
                      <span className="font-medium">
                        {step.name || stepTypeLabels[step.step_type]}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {getStepDescription(step)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteStep(step.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
              {index < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={isAddingStep} onOpenChange={setIsAddingStep}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            ステップを追加
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ステップを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ステップタイプ</Label>
              <Select
                value={newStepType}
                onValueChange={(v) => {
                  setNewStepType(v as StepType)
                  setStepConfig({})
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      メール送信
                    </div>
                  </SelectItem>
                  <SelectItem value="wait">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      待機
                    </div>
                  </SelectItem>
                  <SelectItem value="condition">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      条件分岐
                    </div>
                  </SelectItem>
                  <SelectItem value="line">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      LINE送信
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>ステップ名</Label>
              <Input
                value={stepName}
                onChange={(e) => setStepName(e.target.value)}
                placeholder={stepTypeLabels[newStepType]}
              />
            </div>

            <StepConfigForm
              stepType={newStepType}
              config={stepConfig}
              onChange={setStepConfig}
              tags={tags}
              customFields={customFields}
            />

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAddingStep(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddStep}>
                追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingStep} onOpenChange={(open) => !open && setEditingStep(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ステップを編集</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4">
              <div>
                <Label>ステップ名</Label>
                <Input
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  placeholder={stepTypeLabels[editingStep.step_type]}
                />
              </div>

              <StepConfigForm
                stepType={editingStep.step_type}
                config={stepConfig}
                onChange={setStepConfig}
                tags={tags}
                customFields={customFields}
              />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingStep(null)}>
                  キャンセル
                </Button>
                <Button onClick={handleUpdateStep}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface StepConfigFormProps {
  stepType: StepType
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
}

function StepConfigForm({ stepType, config, onChange, tags, customFields }: StepConfigFormProps) {
  const updateConfig = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value })
  }

  switch (stepType) {
    case 'email':
      return (
        <div className="space-y-4">
          <div>
            <Label>件名</Label>
            <Input
              value={(config.subject as string) || ''}
              onChange={(e) => updateConfig('subject', e.target.value)}
              placeholder="メールの件名"
            />
          </div>
          <div>
            <Label>本文</Label>
            <Textarea
              value={(config.content as string) || ''}
              onChange={(e) => updateConfig('content', e.target.value)}
              placeholder="メール本文 (HTMLまたはプレーンテキスト)"
              rows={6}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {'{{name}}, {{email}}, {{company}} などの変数が使用できます'}
            </p>
          </div>
        </div>
      )

    case 'wait':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>待機時間</Label>
            <Input
              type="number"
              min="1"
              value={(config.wait_value as number) || 1}
              onChange={(e) => updateConfig('wait_value', parseInt(e.target.value))}
            />
          </div>
          <div>
            <Label>単位</Label>
            <Select
              value={(config.wait_unit as string) || 'days'}
              onValueChange={(v) => updateConfig('wait_unit', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">分</SelectItem>
                <SelectItem value="hours">時間</SelectItem>
                <SelectItem value="days">日</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case 'line':
      return (
        <div className="space-y-4">
          <div>
            <Label>メッセージタイプ</Label>
            <Select
              value={(config.line_message_type as string) || 'text'}
              onValueChange={(v) => updateConfig('line_message_type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">テキスト</SelectItem>
                <SelectItem value="flex">Flexメッセージ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(config.line_message_type || 'text') === 'text' && (
            <div>
              <Label>メッセージ</Label>
              <Textarea
                value={((config.line_content as Record<string, unknown>)?.text as string) || ''}
                onChange={(e) => updateConfig('line_content', { text: e.target.value })}
                placeholder="LINEメッセージ"
                rows={4}
              />
            </div>
          )}
        </div>
      )

    case 'condition':
      return (
        <div className="space-y-4 text-sm text-muted-foreground">
          条件分岐の詳細設定は、ステップ作成後に編集画面で設定できます。
        </div>
      )

    default:
      return null
  }
}

function getStepDescription(step: ScenarioStep): string {
  const config = step.config || {}

  switch (step.step_type) {
    case 'email':
      return config.subject ? `件名: ${config.subject}` : ''
    case 'wait':
      const value = config.wait_value || 1
      const unit = config.wait_unit === 'minutes' ? '分' :
                   config.wait_unit === 'hours' ? '時間' : '日'
      return `${value}${unit}後`
    case 'line':
      return config.line_message_type === 'flex' ? 'Flexメッセージ' : 'テキストメッセージ'
    case 'condition':
      return step.condition_type || ''
    default:
      return ''
  }
}
