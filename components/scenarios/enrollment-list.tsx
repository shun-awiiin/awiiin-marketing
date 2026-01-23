'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pause, Play, XCircle, Users } from 'lucide-react'
import type { EnrollmentStatus } from '@/lib/types/l-step'

interface Enrollment {
  id: string
  status: EnrollmentStatus
  enrolled_at: string
  next_action_at: string | null
  completed_at: string | null
  contact: {
    id: string
    email: string
    first_name?: string
  } | null
  current_step: {
    id: string
    name: string | null
    step_type: string
  } | null
}

interface Props {
  scenarioId: string
}

const statusLabels: Record<EnrollmentStatus, string> = {
  active: '実行中',
  completed: '完了',
  paused: '一時停止',
  exited: '離脱'
}

const statusColors: Record<EnrollmentStatus, string> = {
  active: 'default',
  completed: 'secondary',
  paused: 'outline',
  exited: 'destructive'
}

export function EnrollmentList({ scenarioId }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<EnrollmentStatus | ''>('')

  useEffect(() => {
    fetchEnrollments()
  }, [scenarioId, filter])

  const fetchEnrollments = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)

      const response = await fetch(
        `/api/scenarios/${scenarioId}/enroll?${params.toString()}`
      )
      const result = await response.json()

      if (result.success) {
        setEnrollments(result.data || [])
      }
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (enrollmentId: string, newStatus: EnrollmentStatus) => {
    try {
      const response = await fetch(
        `/api/scenarios/${scenarioId}/enrollments/${enrollmentId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        }
      )

      const result = await response.json()

      if (result.success) {
        setEnrollments(enrollments.map(e =>
          e.id === enrollmentId ? { ...e, status: newStatus } : e
        ))
      }
    } catch {
      // Handle error silently
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          読み込み中...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>登録者一覧</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={filter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('')}
          >
            すべて
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            実行中
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
          >
            完了
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter ? `${statusLabels[filter]}の登録者はいません` : '登録者はいません'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コンタクト</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>現在のステップ</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead>次回実行</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {enrollment.contact?.first_name || enrollment.contact?.email}
                      </p>
                      {enrollment.contact?.first_name && (
                        <p className="text-sm text-muted-foreground">
                          {enrollment.contact.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[enrollment.status] as 'default' | 'secondary' | 'outline' | 'destructive'}>
                      {statusLabels[enrollment.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {enrollment.current_step ? (
                      <span className="text-sm">
                        {enrollment.current_step.name || enrollment.current_step.step_type}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(enrollment.enrolled_at).toLocaleDateString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    {enrollment.next_action_at ? (
                      new Date(enrollment.next_action_at).toLocaleString('ja-JP')
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {enrollment.status !== 'completed' && enrollment.status !== 'exited' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {enrollment.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(enrollment.id, 'paused')}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              一時停止
                            </DropdownMenuItem>
                          )}
                          {enrollment.status === 'paused' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(enrollment.id, 'active')}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              再開
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(enrollment.id, 'exited')}
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            離脱させる
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
