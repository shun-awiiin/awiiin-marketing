"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Eye, Edit, Trash2, GraduationCap, Users, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface Module {
  id: string;
  title: string;
  order_index: number;
  lessons: { id: string; title: string; order_index: number }[];
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  module_count: number;
  lesson_count: number;
  created_at: string;
  updated_at: string;
  modules: Module[];
}

interface EnrollmentStat {
  course_id: string;
  access_status: string;
}

interface CourseListClientProps {
  courses: Course[];
  enrollmentStats: EnrollmentStat[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "下書き", variant: "secondary" },
  published: { label: "公開中", variant: "default" },
  archived: { label: "アーカイブ", variant: "outline" },
};

export function CourseListClient({ courses, enrollmentStats }: CourseListClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("このコースを削除しますか？関連するモジュールとレッスンも削除されます。")) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/courses/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      toast.success("コースを削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleting(null);
    }
  };

  const getEnrollmentCount = (courseId: string) => {
    return enrollmentStats.filter(
      (e) => e.course_id === courseId && e.access_status === "active"
    ).length;
  };

  const totalLessons = courses.reduce((sum, c) => sum + c.lesson_count, 0);
  const totalEnrollments = enrollmentStats.filter((e) => e.access_status === "active").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>コース数</CardDescription>
            <CardTitle className="text-2xl">{courses.length}コース</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総レッスン数</CardDescription>
            <CardTitle className="text-2xl">{totalLessons}レッスン</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>受講者数</CardDescription>
            <CardTitle className="text-2xl">{totalEnrollments}人</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>コース一覧</CardTitle>
            <CardDescription>
              {courses.length}件のコースがあります
            </CardDescription>
          </div>
          <Link href="/dashboard/courses/new">
            <Button>
              <Plus className="size-4 mr-2" />
              新規コース
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">コースがありません</h3>
              <p className="text-muted-foreground mb-4">
                会員向けの動画コンテンツを作成しましょう
              </p>
              <Link href="/dashboard/courses/new">
                <Button>
                  <Plus className="size-4 mr-2" />
                  コースを作成
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>コース名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">モジュール</TableHead>
                  <TableHead className="text-right">レッスン</TableHead>
                  <TableHead className="text-right">受講者</TableHead>
                  <TableHead>更新日</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => {
                  const status = statusLabels[course.status] || statusLabels.draft;
                  const enrollments = getEnrollmentCount(course.id);

                  return (
                    <TableRow key={course.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{course.title}</div>
                          <div className="text-sm text-muted-foreground">
                            /member/{course.slug}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {course.module_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {course.lesson_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="size-4 text-muted-foreground" />
                          {enrollments}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(course.updated_at).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/member/${course.slug}`} target="_blank">
                                <PlayCircle className="size-4 mr-2" />
                                プレビュー
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/courses/${course.id}`}>
                                <Eye className="size-4 mr-2" />
                                詳細・編集
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/courses/${course.id}/lessons`}>
                                <GraduationCap className="size-4 mr-2" />
                                レッスン管理
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(course.id)}
                              disabled={isDeleting === course.id}
                            >
                              <Trash2 className="size-4 mr-2" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
