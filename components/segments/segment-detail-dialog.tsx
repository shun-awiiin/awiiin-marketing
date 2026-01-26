'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, Pencil, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Segment, SegmentRules, SegmentCondition } from '@/lib/types/l-step'

interface Contact {
  id: string
  email: string
  first_name?: string
  company?: string
  status: string
  created_at: string
}

interface Props {
  segment: Segment
  tags: Array<{ id: string; name: string }>
  open: boolean
  onClose: () => void
  onEdit: () => void
}

export function SegmentDetailDialog({ segment, tags, open, onClose, onEdit }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 20

  useEffect(() => {
    if (open) {
      fetchContacts()
    }
  }, [open, segment.id, page])

  const fetchContacts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/segments/${segment.id}/contacts?page=${page}&per_page=${perPage}`
      )
      const result = await response.json()

      if (result.success) {
        setContacts(result.data)
        setTotal(result.meta.total)
      }
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false)
    }
  }

  const getConditionDescription = (condition: SegmentCondition): string => {
    switch (condition.type) {
      case 'tag': {
        const tag = tags.find(t => t.id === condition.value)
        const tagName = tag?.name || '不明なタグ'
        return condition.operator === 'exists'
          ? `タグ「${tagName}」あり`
          : `タグ「${tagName}」なし`
      }
      case 'custom_field':
        return `カスタム属性: ${condition.operator} ${condition.value}`
      case 'created_at':
        return condition.operator === 'greater'
          ? `${condition.value} 以降に登録`
          : `${condition.value} 以前に登録`
      case 'status':
        return `ステータス: ${condition.value}`
      case 'email_activity':
        return `メール活動: ${condition.value}`
      default:
        return '不明な条件'
    }
  }

  const getRulesSummary = (rules: SegmentRules): string[] => {
    if (rules.conditions.length === 0) {
      return ['全てのアクティブなコンタクト']
    }
    return rules.conditions.map(getConditionDescription)
  }

  const totalPages = Math.ceil(total / perPage)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{segment.name}</DialogTitle>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              編集
            </Button>
          </div>
          <DialogDescription>セグメントの詳細と該当するコンタクト</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {segment.description && (
            <p className="text-muted-foreground">{segment.description}</p>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-sm">条件</h4>
            <div className="flex flex-wrap gap-2">
              {getRulesSummary(segment.rules).map((desc, i) => (
                <Badge key={i} variant="secondary">
                  {desc}
                </Badge>
              ))}
              {segment.rules.conditions.length > 1 && (
                <Badge variant="outline">
                  {segment.rules.operator === 'AND' ? 'すべて満たす' : 'いずれか満たす'}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{total} 件のコンタクト</span>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                該当するコンタクトがありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>名前</TableHead>
                    <TableHead>会社</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.email}</TableCell>
                      <TableCell>{contact.first_name || '-'}</TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                          {contact.status === 'active' ? '有効' : contact.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {total} 件中 {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} 件
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
