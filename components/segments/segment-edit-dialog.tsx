'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Users, Loader2 } from 'lucide-react'
import { SegmentBuilder } from './segment-builder'
import { useSegmentPreview } from '@/lib/hooks/use-segment-preview'
import type { Segment, SegmentRules } from '@/lib/types/l-step'

interface Props {
  segment: Segment
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
  open: boolean
  onClose: () => void
  onSave: (updated: Segment) => void
}

export function SegmentEditDialog({
  segment,
  tags,
  customFields,
  open,
  onClose,
  onSave
}: Props) {
  const [name, setName] = useState(segment.name)
  const [description, setDescription] = useState(segment.description || '')
  const [rules, setRules] = useState<SegmentRules>(segment.rules)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { count: previewCount, isLoading: isPreviewLoading } = useSegmentPreview(rules)

  useEffect(() => {
    if (open) {
      setName(segment.name)
      setDescription(segment.description || '')
      setRules(segment.rules)
      setError(null)
    }
  }, [open, segment])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('セグメント名を入力してください')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/segments/${segment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          rules
        })
      })

      const result = await response.json()

      if (result.success) {
        onSave(result.data)
        onClose()
      } else {
        setError(result.error)
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>セグメントを編集</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="name">セグメント名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: アクティブユーザー"
            />
          </div>

          <div>
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="セグメントの説明"
              rows={2}
            />
          </div>

          <SegmentBuilder
            rules={rules}
            onChange={setRules}
            tags={tags}
            customFields={customFields}
          />

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">プレビュー:</span>
            {isPreviewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Badge variant="secondary">
                {previewCount !== null ? `${previewCount} 件` : '計算中...'}
              </Badge>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
