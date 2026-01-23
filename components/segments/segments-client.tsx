'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, MoreHorizontal, Trash2, Users, Filter } from 'lucide-react'
import { SegmentBuilder } from './segment-builder'
import type { Segment, SegmentRules } from '@/lib/types/l-step'

interface Props {
  segments: Segment[]
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
}

export function SegmentsClient({ segments: initialSegments, tags, customFields }: Props) {
  const [segments, setSegments] = useState(initialSegments)
  const [isCreating, setIsCreating] = useState(false)
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    rules: { operator: 'AND' as const, conditions: [] }
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    if (!newSegment.name.trim()) {
      alert('セグメント名を入力してください')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSegment)
      })

      const result = await response.json()

      if (result.success) {
        setSegments([result.data, ...segments])
        setIsCreating(false)
        setNewSegment({
          name: '',
          description: '',
          rules: { operator: 'AND', conditions: [] }
        })
      } else {
        alert(result.error)
      }
    } catch {
      alert('作成に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このセグメントを削除しますか?')) return

    try {
      const response = await fetch(`/api/segments/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setSegments(segments.filter(s => s.id !== id))
      }
    } catch {
      // Handle error silently
    }
  }

  const getConditionSummary = (rules: SegmentRules): string => {
    if (rules.conditions.length === 0) {
      return '全てのコンタクト'
    }

    const conditionCount = rules.conditions.length
    const operator = rules.operator === 'AND' ? 'かつ' : 'または'

    return `${conditionCount}件の条件 (${operator})`
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">セグメント</h1>
          <p className="text-muted-foreground">
            条件に基づいてコンタクトを絞り込み
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>セグメントを作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>セグメント名 *</Label>
                <Input
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  placeholder="例: アクティブユーザー"
                />
              </div>
              <div>
                <Label>説明</Label>
                <Textarea
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  placeholder="セグメントの説明"
                  rows={2}
                />
              </div>
              <SegmentBuilder
                rules={newSegment.rules}
                onChange={(rules) => setNewSegment({ ...newSegment, rules })}
                tags={tags}
                customFields={customFields}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleCreate} disabled={isLoading}>
                  {isLoading ? '作成中...' : '作成'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {segments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">セグメントがありません</h3>
            <p className="text-muted-foreground mb-4">
              セグメントを作成して、ターゲットを絞り込みましょう
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              セグメントを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>セグメント一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>セグメント名</TableHead>
                  <TableHead>条件</TableHead>
                  <TableHead className="text-center">該当者数</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => (
                  <TableRow key={segment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{segment.name}</p>
                        {segment.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {segment.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getConditionSummary(segment.rules)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {segment.contact_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(segment.created_at).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDelete(segment.id)}
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
