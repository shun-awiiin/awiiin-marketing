"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  PlayCircle,
  CheckCircle,
  Home,
} from "lucide-react";
import { toast } from "sonner";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  bunny_video_id: string | null;
  is_preview: boolean;
  module_id: string;
  modules: {
    id: string;
    title: string;
    courses: {
      id: string;
      title: string;
      slug: string;
    };
  };
}

interface Course {
  id: string;
  title: string;
  slug: string;
}

interface Enrollment {
  id: string;
}

interface NavLesson {
  id: string;
  title: string;
  is_preview: boolean;
}

interface MemberLessonClientProps {
  lesson: Lesson;
  course: Course;
  hasAccess: boolean;
  enrollment: Enrollment | null;
  customerId: string | null;
  currentProgress: number;
  prevLesson: NavLesson | null;
  nextLesson: NavLesson | null;
}

export function MemberLessonClient({
  lesson,
  course,
  hasAccess,
  enrollment,
  customerId,
  currentProgress,
  prevLesson,
  nextLesson,
}: MemberLessonClientProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(currentProgress >= 90);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasAccess || !lesson.bunny_video_id) {
      setIsLoading(false);
      return;
    }

    const fetchVideoToken = async () => {
      try {
        const params = new URLSearchParams();
        if (customerId) {
          params.set("customer_id", customerId);
        }

        const response = await fetch(
          `/api/lessons/${lesson.id}/video-token?${params.toString()}`
        );
        const data = await response.json();

        if (data.success) {
          setVideoUrl(data.data.signed_url);
        } else {
          toast.error("動画の読み込みに失敗しました");
        }
      } catch {
        toast.error("動画の読み込みに失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoToken();
  }, [hasAccess, lesson.id, lesson.bunny_video_id, customerId]);

  const updateProgress = async (percent: number) => {
    if (!enrollment || !customerId) return;

    try {
      await fetch(`/api/lessons/${lesson.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          progress_percent: percent,
          completed: percent >= 90,
        }),
      });

      if (percent >= 90 && !isCompleted) {
        setIsCompleted(true);
        toast.success("レッスンを完了しました！");
      }
    } catch {
      // Silently fail progress updates
    }
  };

  const handleVideoProgress = (event: MessageEvent) => {
    if (event.origin !== "https://iframe.mediadelivery.net") return;

    try {
      const data = JSON.parse(event.data);
      if (data.event === "timeupdate" && data.data?.percent) {
        const percent = Math.round(data.data.percent * 100);
        if (percent > currentProgress) {
          updateProgress(percent);
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  useEffect(() => {
    window.addEventListener("message", handleVideoProgress);
    return () => window.removeEventListener("message", handleVideoProgress);
  }, [currentProgress, isCompleted]);

  const getLessonUrl = (lessonId: string) => {
    const base = `/member/${course.slug}/${lessonId}`;
    return customerId ? `${base}?customer_id=${customerId}` : base;
  };

  const getCourseUrl = () => {
    const base = `/member/${course.slug}`;
    return customerId ? `${base}?customer_id=${customerId}` : base;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={getCourseUrl()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="size-4" />
            <span className="hidden sm:inline">{course.title}</span>
          </Link>
          <div className="flex items-center gap-2">
            {prevLesson && (
              <Link href={getLessonUrl(prevLesson.id)}>
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="size-4 mr-1" />
                  <span className="hidden sm:inline">前のレッスン</span>
                </Button>
              </Link>
            )}
            {nextLesson && (
              <Link href={getLessonUrl(nextLesson.id)}>
                <Button variant="ghost" size="sm">
                  <span className="hidden sm:inline">次のレッスン</span>
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <span>{lesson.modules.title}</span>
              </div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {lesson.title}
                {isCompleted && <CheckCircle className="size-5 text-green-500" />}
              </h1>
            </div>

            {hasAccess ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden mb-6">
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                  </div>
                ) : videoUrl ? (
                  <iframe
                    src={videoUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <PlayCircle className="size-16 mx-auto mb-4 opacity-50" />
                      <p>動画が設定されていません</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-6">
                <div className="text-center">
                  <Lock className="size-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-bold mb-2">このレッスンは限定公開です</h2>
                  <p className="text-muted-foreground mb-4">
                    コースを購入すると視聴できます
                  </p>
                  <Button>コースを購入する</Button>
                </div>
              </div>
            )}

            {lesson.description && (
              <Card>
                <CardHeader>
                  <CardTitle>レッスン概要</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{lesson.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>進捗</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollment ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>このレッスン</span>
                        <span>{Math.round(currentProgress)}%</span>
                      </div>
                      <Progress value={currentProgress} />
                    </div>

                    {isCompleted && (
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <CheckCircle className="size-8 mx-auto text-green-500 mb-2" />
                        <p className="font-medium text-green-700">完了済み</p>
                      </div>
                    )}

                    {nextLesson && !isCompleted && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">次のレッスン</p>
                        <Link href={getLessonUrl(nextLesson.id)}>
                          <Button className="w-full" variant="outline">
                            {nextLesson.title}
                            <ChevronRight className="size-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ) : lesson.is_preview ? (
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      これはプレビューレッスンです
                    </p>
                    <Button className="w-full">コースを購入する</Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Lock className="size-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      コースを購入すると視聴できます
                    </p>
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
