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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, ListIcon } from 'lucide-react'
import type { List } from '@/lib/types/list'
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

interface Props {
  contactIds: string[]
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function ListAssignDialog({ contactIds, open, onClose, onComplete }: Props) {
  const orgFetch = useOrgFetch();
  const [lists, setLists] = useState<List[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetchLists()
      setSelectedListIds([])
    }
  }, [open])

  const fetchLists = async () => {
    setIsLoading(true)
    try {
      const response = await orgFetch('/api/lists')
      const result = await response.json()

      if (result.success) {
        setLists(result.data)
      }
    } catch {
      // Handle silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = (listId: string, checked: boolean) => {
    if (checked) {
      setSelectedListIds([...selectedListIds, listId])
    } else {
      setSelectedListIds(selectedListIds.filter(id => id !== listId))
    }
  }

  const handleSave = async () => {
    if (selectedListIds.length === 0) {
      alert('リストを選択してください')
      return
    }

    setIsSaving(true)
    try {
      const results = await Promise.all(
        selectedListIds.map(listId =>
          orgFetch(`/api/lists/${listId}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_ids: contactIds })
          }).then(res => res.json())
        )
      )

      const allSuccess = results.every(r => r.success)
      if (allSuccess) {
        onComplete()
        onClose()
      } else {
        alert('一部のリストへの追加に失敗しました')
      }
    } catch {
      alert('追加に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>リストに追加</DialogTitle>
          <DialogDescription>
            {contactIds.length}件のコンタクトを追加するリストを選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ListIcon className="h-8 w-8 mb-2" />
              <p>リストがありません</p>
              <p className="text-sm">先にリストを作成してください</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {lists.map(list => (
                <label
                  key={list.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedListIds.includes(list.id)}
                    onCheckedChange={(checked) => handleSelect(list.id, checked as boolean)}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{list.name}</p>
                    {list.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {list.description}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {list.contact_count}件
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || selectedListIds.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  追加中...
                </>
              ) : (
                '追加'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
