'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Users, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import type { List } from '@/lib/types/list'

interface Contact {
  id: string
  email: string
  first_name: string | null
  company: string | null
  status: string
  created_at: string
}

interface Props {
  list: List
  open: boolean
  onClose: () => void
  onUpdate: (list: List) => void
}

export function ListDetailDialog({ list, open, onClose, onUpdate }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isRemoving, setIsRemoving] = useState(false)
  const perPage = 20

  useEffect(() => {
    if (open) {
      setPage(1)
      setSelectedIds([])
      fetchContacts(1)
    }
  }, [open, list.id])

  useEffect(() => {
    if (open && page > 1) {
      fetchContacts(page)
    }
  }, [page])

  const fetchContacts = async (p: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/lists/${list.id}/contacts?page=${p}&per_page=${perPage}`
      )
      const result = await response.json()

      if (result.success) {
        setContacts(result.data)
        setTotal(result.meta.total)
      }
    } catch {
      // Handle silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(contacts.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id))
    }
  }

  const handleRemoveSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`${selectedIds.length}件のコンタクトをリストから削除しますか？`)) return

    setIsRemoving(true)
    try {
      const response = await fetch(`/api/lists/${list.id}/contacts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_ids: selectedIds })
      })

      const result = await response.json()

      if (result.success) {
        const newTotal = total - selectedIds.length
        setTotal(newTotal)
        setContacts(contacts.filter(c => !selectedIds.includes(c.id)))
        setSelectedIds([])
        onUpdate({
          ...list,
          contact_count: newTotal
        })
      }
    } catch {
      alert('削除に失敗しました')
    } finally {
      setIsRemoving(false)
    }
  }

  const totalPages = Math.ceil(total / perPage)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: list.color }}
            />
            <DialogTitle className="text-xl">{list.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {list.description && (
            <p className="text-muted-foreground">{list.description}</p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{total} 件のコンタクト</span>
            </div>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveSelected}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {selectedIds.length}件を削除
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                リストにコンタクトがありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === contacts.length && contacts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>名前</TableHead>
                    <TableHead>会社</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(contact.id)}
                          onCheckedChange={(checked) =>
                            handleSelect(contact.id, checked as boolean)
                          }
                        />
                      </TableCell>
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
