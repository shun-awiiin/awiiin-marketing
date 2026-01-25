import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberLessonClient } from "@/components/member/member-lesson-client";

interface Props {
  params: Promise<{ courseSlug: string; lessonId: string }>;
  searchParams: Promise<{ customer_id?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { courseSlug, lessonId } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(`
      title,
      modules!inner (
        courses!inner (slug)
      )
    `)
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    return { title: "レッスンが見つかりません" };
  }

  return {
    title: lesson.title,
    robots: { index: false, follow: false },
  };
}

export default async function MemberLessonPage({ params, searchParams }: Props) {
  const { courseSlug, lessonId } = await params;
  const { customer_id: customerId } = await searchParams;
  const supabase = await createClient();

  // Get lesson with course info
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select(`
      *,
      modules!inner (
        id,
        title,
        courses!inner (
          id,
          title,
          slug
        )
      )
    `)
    .eq("id", lessonId)
    .single();

  if (error || !lesson) {
    notFound();
  }

  // Verify course slug matches
  const course = lesson.modules.courses;
  if (course.slug !== courseSlug) {
    notFound();
  }

  // Check access for non-preview lessons
  let hasAccess = lesson.is_preview;
  let enrollment = null;
  let currentProgress = 0;

  if (!hasAccess && customerId) {
    const { data: enrollmentData } = await supabase
      .from("course_enrollments")
      .select("*")
      .eq("course_id", course.id)
      .eq("customer_id", customerId)
      .eq("access_status", "active")
      .single();

    if (enrollmentData) {
      hasAccess = true;
      enrollment = enrollmentData;

      // Get current progress
      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("progress_percent")
        .eq("enrollment_id", enrollment.id)
        .eq("lesson_id", lessonId)
        .single();

      if (progressData) {
        currentProgress = progressData.progress_percent;
      }
    }
  }

  // Get all lessons in the module for navigation
  const { data: moduleLessons } = await supabase
    .from("lessons")
    .select("id, title, order_index, is_preview")
    .eq("module_id", lesson.module_id)
    .order("order_index");

  // Find current lesson index and next/prev
  const currentIndex = moduleLessons?.findIndex((l) => l.id === lessonId) ?? -1;
  const prevLesson = currentIndex > 0 ? moduleLessons?.[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < (moduleLessons?.length ?? 0) - 1
      ? moduleLessons?.[currentIndex + 1]
      : null;

  return (
    <MemberLessonClient
      lesson={lesson}
      course={course}
      hasAccess={hasAccess}
      enrollment={enrollment}
      customerId={customerId || null}
      currentProgress={currentProgress}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
    />
  );
}
