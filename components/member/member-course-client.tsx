"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PlayCircle, CheckCircle, Lock, Clock, BookOpen } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  is_preview: boolean;
  order_index: number;
  bunny_video_id: string | null;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  modules: Module[];
}

interface Enrollment {
  id: string;
  progress_percent: number;
  completed_lessons: number;
  total_lessons: number;
}

interface LessonProgress {
  completed: boolean;
  progress_percent: number;
}

interface MemberCourseClientProps {
  course: Course;
  enrollment: Enrollment | null;
  progress: Record<string, LessonProgress>;
  customerId: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function MemberCourseClient({
  course,
  enrollment,
  progress,
  customerId,
}: MemberCourseClientProps) {
  const totalLessons = course.modules.reduce(
    (sum, module) => sum + module.lessons.length,
    0
  );
  const completedLessons = Object.values(progress).filter((p) => p.completed).length;
  const overallProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  const getLessonUrl = (lessonId: string) => {
    const base = `/member/${course.slug}/${lessonId}`;
    return customerId ? `${base}?customer_id=${customerId}` : base;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold">{course.title}</h1>
          {course.description && (
            <p className="text-muted-foreground mt-2">{course.description}</p>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5" />
                  コースカリキュラム
                </CardTitle>
                <CardDescription>
                  {course.modules.length}モジュール / {totalLessons}レッスン
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={course.modules.map((m) => m.id)}>
                  {course.modules.map((module) => {
                    const moduleCompletedLessons = module.lessons.filter(
                      (l) => progress[l.id]?.completed
                    ).length;

                    return (
                      <AccordionItem key={module.id} value={module.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <span className="font-medium">{module.title}</span>
                            <Badge variant="secondary">
                              {moduleCompletedLessons}/{module.lessons.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {module.description && (
                            <p className="text-muted-foreground text-sm mb-4">
                              {module.description}
                            </p>
                          )}
                          <div className="space-y-2">
                            {module.lessons.map((lesson) => {
                              const lessonProgress = progress[lesson.id];
                              const isCompleted = lessonProgress?.completed;
                              const hasAccess = enrollment || lesson.is_preview;

                              return (
                                <Link
                                  key={lesson.id}
                                  href={getLessonUrl(lesson.id)}
                                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${
                                    !hasAccess ? "opacity-60" : ""
                                  }`}
                                >
                                  <div className="shrink-0">
                                    {isCompleted ? (
                                      <CheckCircle className="size-5 text-green-500" />
                                    ) : hasAccess ? (
                                      <PlayCircle className="size-5 text-primary" />
                                    ) : (
                                      <Lock className="size-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium truncate">
                                        {lesson.title}
                                      </span>
                                      {lesson.is_preview && (
                                        <Badge variant="outline" className="shrink-0">
                                          プレビュー
                                        </Badge>
                                      )}
                                    </div>
                                    {lessonProgress && !isCompleted && (
                                      <Progress
                                        value={lessonProgress.progress_percent}
                                        className="h-1 mt-1"
                                      />
                                    )}
                                  </div>
                                  {lesson.duration_seconds && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                                      <Clock className="size-4" />
                                      {formatDuration(lesson.duration_seconds)}
                                    </div>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>進捗</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollment ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>完了</span>
                        <span>
                          {completedLessons}/{totalLessons}レッスン
                        </span>
                      </div>
                      <Progress value={overallProgress} />
                      <p className="text-center text-2xl font-bold mt-2">
                        {Math.round(overallProgress)}%
                      </p>
                    </div>

                    {completedLessons === totalLessons && (
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <CheckCircle className="size-8 mx-auto text-green-500 mb-2" />
                        <p className="font-medium text-green-700">
                          コース完了おめでとうございます！
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <Lock className="size-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      このコースを受講するには、購入が必要です
                    </p>
                    <Button className="w-full">コースを購入する</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
