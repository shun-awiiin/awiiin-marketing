'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { List } from '@/lib/types/list'
import { useOrgFetch } from "@/lib/hooks/use-org-fetch";

const PRESET_COLORS = [
  '#6B7280', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6'
]

interface Tag {
  id: string
  name: string
  color: string
}

export interface ImportSettingsData {
  updateExisting: boolean
  selectedTagIds: string[]
  newTagName: string
  newTagColor: string
  selectedListId: string
  newListName: string
}

interface Props {
  settings: ImportSettingsData
  onChange: (settings: ImportSettingsData) => void
  tags: Tag[]
  lists: List[]
  isLoading?: boolean
}

export function ImportSettings({ settings, onChange, tags, lists, isLoading }: Props) {
  const handleTagToggle = (tagId: string, checked: boolean) => {
    const newIds = checked
      ? [...settings.selectedTagIds, tagId]
      : settings.selectedTagIds.filter(id => id !== tagId)
    onChange({ ...settings, selectedTagIds: newIds })
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="updateExisting"
          checked={settings.updateExisting}
          onCheckedChange={(checked) =>
            onChange({ ...settings, updateExisting: checked as boolean })
          }
          disabled={isLoading}
        />
        <Label htmlFor="updateExisting" className="cursor-pointer">
          既存の連絡先を更新する
        </Label>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">タグを付与（任意）</Label>

        {tags.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-2 p-2 border rounded-lg">
            {tags.map(tag => (
              <label
                key={tag.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={settings.selectedTagIds.includes(tag.id)}
                  onCheckedChange={(checked) => handleTagToggle(tag.id, checked as boolean)}
                  disabled={isLoading}
                />
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                </Badge>
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            または新規タグを作成:
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="新規タグ名"
              value={settings.newTagName}
              onChange={(e) => onChange({ ...settings, newTagName: e.target.value })}
              disabled={isLoading}
              className="flex-1"
            />
          </div>
          {settings.newTagName && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">色:</span>
              <div className="flex gap-1">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 ${
                      settings.newTagColor === color ? 'border-primary' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => onChange({ ...settings, newTagColor: color })}
                    disabled={isLoading}
                  />
                ))}
              </div>
              <Badge
                variant="secondary"
                style={{ backgroundColor: settings.newTagColor + '20', color: settings.newTagColor }}
                className="ml-2"
              >
                {settings.newTagName}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">リストに追加（任意）</Label>
        <Select
          value={settings.selectedListId || 'none'}
          onValueChange={(value) =>
            onChange({
              ...settings,
              selectedListId: value === 'none' ? '' : value,
              newListName: value === 'new' ? settings.newListName : ''
            })
          }
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="リストを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">リストに追加しない</SelectItem>
            <SelectItem value="new">新規リストを作成</SelectItem>
            {lists.map(list => (
              <SelectItem key={list.id} value={list.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                  {list.name} ({list.contact_count}件)
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {settings.selectedListId === 'new' && (
          <Input
            placeholder="新規リスト名"
            value={settings.newListName}
            onChange={(e) => onChange({ ...settings, newListName: e.target.value })}
            disabled={isLoading}
          />
        )}
      </div>
    </div>
  )
}

export function useImportSettings() {
  const orgFetch = useOrgFetch();
  const [settings, setSettings] = useState<ImportSettingsData>({
    updateExisting: true,
    selectedTagIds: [],
    newTagName: '',
    newTagColor: '#6B7280',
    selectedListId: '',
    newListName: ''
  })
  const [tags, setTags] = useState<Tag[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch tags
        const tagsRes = await orgFetch('/api/tags')
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json()
          if (tagsData.data) setTags(tagsData.data)
        }

        // Fetch lists separately to handle errors gracefully
        try {
          const listsRes = await orgFetch('/api/lists')
          if (listsRes.ok) {
            const listsData = await listsRes.json()
            if (listsData.success && listsData.data) {
              setLists(listsData.data)
            }
          }
        } catch {
          // Lists table might not exist yet
          setLists([])
        }
      } catch {
        // Handle silently
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const reset = () => {
    setSettings({
      updateExisting: true,
      selectedTagIds: [],
      newTagName: '',
      newTagColor: '#6B7280',
      selectedListId: '',
      newListName: ''
    })
  }

  return {
    settings,
    setSettings,
    tags,
    lists,
    isLoading,
    reset
  }
}
