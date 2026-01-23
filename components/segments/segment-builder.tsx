'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { SegmentRules, SegmentCondition } from '@/lib/types/l-step'

interface Props {
  rules: SegmentRules
  onChange: (rules: SegmentRules) => void
  tags: Array<{ id: string; name: string }>
  customFields: Array<{ id: string; name: string; field_key: string }>
}

export function SegmentBuilder({ rules, onChange, tags, customFields }: Props) {
  const addCondition = () => {
    const newCondition: SegmentCondition = {
      type: 'tag',
      operator: 'exists',
      value: ''
    }
    onChange({
      ...rules,
      conditions: [...rules.conditions, newCondition]
    })
  }

  const updateCondition = (index: number, updates: Partial<SegmentCondition>) => {
    const newConditions = [...rules.conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    onChange({ ...rules, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    const newConditions = rules.conditions.filter((_, i) => i !== index)
    onChange({ ...rules, conditions: newConditions })
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Label>条件の組み合わせ:</Label>
          <Select
            value={rules.operator}
            onValueChange={(v) => onChange({ ...rules, operator: v as 'AND' | 'OR' })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">すべて満たす</SelectItem>
              <SelectItem value="OR">いずれか満たす</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {rules.conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg flex-wrap">
              <Select
                value={condition.type}
                onValueChange={(v) => updateCondition(index, {
                  type: v as SegmentCondition['type'],
                  field: undefined,
                  value: ''
                })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="条件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">タグ</SelectItem>
                  <SelectItem value="custom_field">カスタム属性</SelectItem>
                  <SelectItem value="created_at">登録日</SelectItem>
                  <SelectItem value="status">ステータス</SelectItem>
                </SelectContent>
              </Select>

              {condition.type === 'tag' && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as SegmentCondition['operator'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exists">あり</SelectItem>
                      <SelectItem value="not_exists">なし</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(condition.value || '')}
                    onValueChange={(v) => updateCondition(index, { value: v })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="タグを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {condition.type === 'custom_field' && (
                <>
                  <Select
                    value={condition.field || ''}
                    onValueChange={(v) => updateCondition(index, { field: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="属性" />
                    </SelectTrigger>
                    <SelectContent>
                      {customFields.map(field => (
                        <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as SegmentCondition['operator'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">等しい</SelectItem>
                      <SelectItem value="not_equals">等しくない</SelectItem>
                      <SelectItem value="contains">含む</SelectItem>
                      <SelectItem value="exists">値あり</SelectItem>
                      <SelectItem value="not_exists">値なし</SelectItem>
                    </SelectContent>
                  </Select>
                  {condition.operator !== 'exists' && condition.operator !== 'not_exists' && (
                    <Input
                      placeholder="値"
                      value={String(condition.value || '')}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      className="w-32"
                    />
                  )}
                </>
              )}

              {condition.type === 'created_at' && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as SegmentCondition['operator'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="greater">以降</SelectItem>
                      <SelectItem value="less">以前</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={String(condition.value || '')}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="w-40"
                  />
                </>
              )}

              {condition.type === 'status' && (
                <>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, { operator: v as SegmentCondition['operator'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">等しい</SelectItem>
                      <SelectItem value="not_equals">等しくない</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(condition.value || '')}
                    onValueChange={(v) => updateCondition(index, { value: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="ステータス" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">有効</SelectItem>
                      <SelectItem value="bounced">バウンス</SelectItem>
                      <SelectItem value="complained">苦情</SelectItem>
                      <SelectItem value="unsubscribed">配信停止</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCondition(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={addCondition} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          条件を追加
        </Button>

        {rules.conditions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            条件なしの場合、全てのアクティブなコンタクトが対象になります
          </p>
        )}
      </CardContent>
    </Card>
  )
}
