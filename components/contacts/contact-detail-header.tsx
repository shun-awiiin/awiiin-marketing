'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ContactWithTags } from '@/lib/types/database'
import {
  Mail,
  Building2,
  Pencil,
  Eye,
  MousePointerClick,
  Clock,
} from 'lucide-react'

interface EngagementMetrics {
  engagement_score?: number
  total_opens?: number
  total_clicks?: number
  last_open_at?: string | null
}

interface ContactDetailHeaderProps {
  contact: ContactWithTags
  metrics?: EngagementMetrics
  onEdit?: () => void
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'アクティブ', variant: 'default' },
  bounced: { label: 'バウンス', variant: 'destructive' },
  complained: { label: '苦情', variant: 'destructive' },
  unsubscribed: { label: '配信停止', variant: 'secondary' },
}

function getInitials(contact: ContactWithTags): string {
  if (contact.first_name) {
    return contact.first_name.slice(0, 2).toUpperCase()
  }
  return contact.email.slice(0, 2).toUpperCase()
}

export function ContactDetailHeader({
  contact,
  metrics,
  onEdit,
}: ContactDetailHeaderProps) {
  const statusInfo = STATUS_LABELS[contact.status] || STATUS_LABELS.active

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          {/* Left: Avatar + Info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
              {getInitials(contact)}
            </div>

            {/* Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {contact.first_name || contact.email}
                </h1>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {contact.email}
                </span>
                {contact.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {contact.company}
                  </span>
                )}
              </div>

              {/* Tags */}
              {contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {contact.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      style={{
                        borderColor: tag.color,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Edit button */}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              編集
            </Button>
          )}
        </div>

        {/* Engagement Metrics */}
        {metrics && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            {metrics.engagement_score !== undefined && (
              <MetricItem
                label="エンゲージメントスコア"
                value={String(metrics.engagement_score)}
              />
            )}
            {metrics.total_opens !== undefined && (
              <MetricItem
                icon={<Eye className="h-3.5 w-3.5 text-green-600" />}
                label="開封数"
                value={String(metrics.total_opens)}
              />
            )}
            {metrics.total_clicks !== undefined && (
              <MetricItem
                icon={<MousePointerClick className="h-3.5 w-3.5 text-blue-600" />}
                label="クリック数"
                value={String(metrics.total_clicks)}
              />
            )}
            {metrics.last_open_at && (
              <MetricItem
                icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                label="最終開封"
                value={new Date(metrics.last_open_at).toLocaleDateString('ja-JP')}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1 text-sm font-medium">
        {icon}
        {value}
      </p>
    </div>
  )
}
