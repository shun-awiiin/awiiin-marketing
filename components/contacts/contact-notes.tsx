'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { ContactNote } from '@/lib/types/timeline'
import {
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react'

interface ContactNotesProps {
  contactId: string
  initialNotes: ContactNote[]
}

export function ContactNotes({ contactId, initialNotes }: ContactNotesProps) {
  const [notes, setNotes] = useState<ContactNote[]>(initialNotes)
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // ---- Create ----
  const handleCreate = useCallback(async () => {
    if (!newContent.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setNotes((prev) => [json.data, ...prev])
        setNewContent('')
      }
    } catch (error) {
      console.error('Failed to create note:', error)
    } finally {
      setSubmitting(false)
    }
  }, [contactId, newContent])

  // ---- Edit ----
  const startEdit = useCallback((note: ContactNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditContent('')
  }, [])

  const saveEdit = useCallback(async (noteId: string) => {
    if (!editContent.trim()) return
    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId, content: editContent.trim() }),
      })
      if (res.ok) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, content: editContent.trim(), updated_at: new Date().toISOString() }
              : n
          )
        )
        setEditingId(null)
        setEditContent('')
      }
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }, [contactId, editContent])

  // ---- Delete ----
  const handleDelete = useCallback(async (noteId: string) => {
    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId }),
      })
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }, [contactId])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ノート</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New note form */}
        <div className="space-y-2">
          <Textarea
            placeholder="ノートを追加..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={submitting || !newContent.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  保存中...
                </>
              ) : (
                '追加'
              )}
            </Button>
          </div>
        </div>

        {/* Notes list */}
        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            ノートはまだありません
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isEditing={editingId === note.id}
                editContent={editContent}
                onEditContentChange={setEditContent}
                onStartEdit={() => startEdit(note)}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => saveEdit(note.id)}
                onDelete={() => handleDelete(note.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// NOTE ITEM
// ============================================

interface NoteItemProps {
  note: ContactNote
  isEditing: boolean
  editContent: string
  onEditContentChange: (val: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: () => void
}

function NoteItem({
  note,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: NoteItemProps) {
  const relativeTime = formatDistanceToNow(new Date(note.created_at), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <div className="rounded-md border p-3">
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              <X className="mr-1 h-3.5 w-3.5" />
              キャンセル
            </Button>
            <Button size="sm" onClick={onSaveEdit} disabled={!editContent.trim()}>
              <Check className="mr-1 h-3.5 w-3.5" />
              保存
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{note.content}</p>
          <div className="mt-2 flex items-center justify-between">
            <time className="text-xs text-muted-foreground" title={note.created_at}>
              {relativeTime}
            </time>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
