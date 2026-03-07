'use client';

import { useMemo } from 'react';
import { notFound, useParams } from "next/navigation";
import CourseView from "@/components/course-view";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import type { Course } from "@/lib/data";

export default function CoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;

  const firestore = useFirestore();
  
  const courseRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);

  const { data: courseData, isLoading } = useDoc(courseRef);

  const course: Course | null = useMemo(() => {
    if (!courseData) {
      return null;
    }
    return {
        id: courseData.id,
        title: courseData.title,
        description: courseData.description,
        thumbnailUrl: courseData.thumbnailUrl,
        thumbnailHint: `course ${courseData.id}`,
        targetClass: courseData.targetClass,
        chapters: (courseData.chapters || []).map((chapter: any) => ({
          ...chapter,
          lectures: (chapter.lectures || []).map((lecture: any) => {
            const { durationSeconds, ...rest } = lecture;
            return {
              ...rest,
              duration: Math.round((durationSeconds || 0) / 60),
            };
          }),
        })),
        instructor: {
          name: courseData.instructorName || 'Instructor',
          avatarUrl: courseData.instructorAvatarUrl || `https://picsum.photos/seed/${courseData.instructorId}/40/40`,
        }
    };
  }, [courseData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!course) {
    notFound();
  }
  
  return <CourseView course={course} />;
}
