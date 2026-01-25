import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberCourseClient } from "@/components/member/member-course-client";

interface Props {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{ customer_id?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { courseSlug } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("title, description")
    .eq("slug", courseSlug)
    .eq("status", "published")
    .single();

  if (!course) {
    return { title: "コースが見つかりません" };
  }

  return {
    title: course.title,
    description: course.description,
    robots: { index: false, follow: false },
  };
}

export default async function MemberCoursePage({ params, searchParams }: Props) {
  const { courseSlug } = await params;
  const { customer_id: customerId } = await searchParams;
  const supabase = await createClient();

  // Get course with modules and lessons
  const { data: course, error } = await supabase
    .from("courses")
    .select(`
      *,
      modules (
        id,
        title,
        description,
        order_index,
        lessons (
          id,
          title,
          description,
          duration_seconds,
          is_preview,
          order_index,
          bunny_video_id
        )
      )
    `)
    .eq("slug", courseSlug)
    .eq("status", "published")
    .single();

  if (error || !course) {
    notFound();
  }

  // Check enrollment if customer_id is provided
  let enrollment = null;
  let progress: Record<string, { completed: boolean; progress_percent: number }> = {};

  if (customerId) {
    const { data: enrollmentData } = await supabase
      .from("course_enrollments")
      .select("*")
      .eq("course_id", course.id)
      .eq("customer_id", customerId)
      .eq("access_status", "active")
      .single();

    enrollment = enrollmentData;

    if (enrollment) {
      // Get progress for all lessons
      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed, progress_percent")
        .eq("enrollment_id", enrollment.id);

      if (progressData) {
        progress = progressData.reduce((acc, p) => {
          acc[p.lesson_id] = {
            completed: p.completed,
            progress_percent: p.progress_percent,
          };
          return acc;
        }, {} as Record<string, { completed: boolean; progress_percent: number }>);
      }
    }
  }

  // Sort modules and lessons by order_index
  const sortedCourse = {
    ...course,
    modules: course.modules
      .sort((a, b) => a.order_index - b.order_index)
      .map((module) => ({
        ...module,
        lessons: module.lessons.sort((a, b) => a.order_index - b.order_index),
      })),
  };

  return (
    <MemberCourseClient
      course={sortedCourse}
      enrollment={enrollment}
      progress={progress}
      customerId={customerId || null}
    />
  );
}
