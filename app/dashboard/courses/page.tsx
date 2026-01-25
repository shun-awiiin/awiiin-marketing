import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CourseListClient } from "@/components/courses/course-list-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "コース管理",
};

async function CourseList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: courses } = await supabase
    .from("courses")
    .select(`
      *,
      modules (
        id,
        title,
        order_index,
        lessons (id, title, order_index)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: enrollmentStats } = await supabase
    .from("course_enrollments")
    .select("course_id, access_status")
    .in("course_id", (courses || []).map((c) => c.id));

  return (
    <CourseListClient
      courses={courses || []}
      enrollmentStats={enrollmentStats || []}
    />
  );
}

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">コース管理</h1>
        <p className="text-muted-foreground">
          会員向けコンテンツを作成・管理
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <CourseList />
      </Suspense>
    </div>
  );
}
