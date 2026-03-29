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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, MoreHorizontal, Trash2, Users, ListIcon, Pencil, Eye } from 'lucide-react'
import { ListDetailDialog } from './list-detail-dialog'
import type { List } from '@/lib/types/list'
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

const PRESET_COLORS = [
  '#6B7280', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6'
]

interface Props {
  lists: List[]
}

export function ListsClient({ lists: initialLists }: Props) {
  const orgFetch = useOrgFetch();
  const [lists, setLists] = useState(initialLists)
  const [isCreating, setIsCreating] = useState(false)
  const [newList, setNewList] = useState({ name: '', description: '', color: '#6B7280' })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingList, setEditingList] = useState<List | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const handleCreate = async () => {
    if (!newList.name.trim()) {
      alert('リスト名を入力してください')
      return
    }

    setIsLoading(true)
    try {
      const response = await orgFetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newList)
      })

      const result = await response.json()

      if (result.success) {
        setLists([result.data, ...lists])
        setIsCreating(false)
        setNewList({ name: '', description: '', color: '#6B7280' })
      } else {
        alert(result.error)
      }
    } catch {
      alert('作成に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingList) return

    setIsLoading(true)
    try {
      const response = await orgFetch(`/api/lists/${editingList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingList.name,
          description: editingList.description,
          color: editingList.color
        })
      })

      const result = await response.json()

      if (result.success) {
        setLists(lists.map(l => l.id === result.data.id ? result.data : l))
        setIsEditOpen(false)
        setEditingList(null)
      } else {
        alert(result.error)
      }
    } catch {
      alert('更新に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このリストを削除しますか？\nリスト内のコンタクトは削除されません。')) return

    try {
      const response = await orgFetch(`/api/lists/${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        setLists(lists.filter(l => l.id !== id))
      }
    } catch {
      // Handle silently
    }
  }

  const openEdit = (list: List) => {
    setEditingList({ ...list })
    setIsEditOpen(true)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">リスト</h1>
          <p className="text-muted-foreground">コンタクトを手動でグループ分け</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>リストを作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>リスト名 *</Label>
                <Input
                  value={newList.name}
                  onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                  placeholder="例: VIP顧客"
                />
              </div>
              <div>
                <Label>説明</Label>
                <Textarea
                  value={newList.description}
                  onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                  placeholder="リストの説明"
                  rows={2}
                />
              </div>
              <div>
                <Label>色</Label>
                <div className="flex gap-2 mt-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        newList.color === color ? 'border-primary' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewList({ ...newList, color })}
                    />
                  ))}
                </div>
              </div>
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

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">リストがありません</h3>
            <p className="text-muted-foreground mb-4">
              リストを作成して、コンタクトを整理しましょう
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              リストを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>リスト一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>リスト名</TableHead>
                  <TableHead className="text-center">コンタクト数</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow
                    key={list.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedList(list)
                      setIsDetailOpen(true)
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: list.color }}
                        />
                        <div>
                          <p className="font-medium">{list.name}</p>
                          {list.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {list.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {list.contact_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(list.created_at).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedList(list)
                            setIsDetailOpen(true)
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            詳細
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(list)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(list.id)}
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open)
        if (!open) setEditingList(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>リストを編集</DialogTitle>
          </DialogHeader>
          {editingList && (
            <div className="space-y-4">
              <div>
                <Label>リスト名 *</Label>
                <Input
                  value={editingList.name}
                  onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
                />
              </div>
              <div>
                <Label>説明</Label>
                <Textarea
                  value={editingList.description || ''}
                  onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>色</Label>
                <div className="flex gap-2 mt-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        editingList.color === color ? 'border-primary' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingList({ ...editingList, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleUpdate} disabled={isLoading}>
                  {isLoading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedList && (
        <ListDetailDialog
          list={selectedList}
          open={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false)
            setSelectedList(null)
          }}
          onUpdate={(updated) => {
            setLists(lists.map(l => l.id === updated.id ? updated : l))
            setSelectedList(updated)
          }}
        />
      )}
    </div>
  )
}
