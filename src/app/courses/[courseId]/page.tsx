'use client';

import { notFound } from "next/navigation";
import CourseView from "@/components/course-view";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import type { Course } from "@/lib/data";

type CoursePageProps = {
  params: {
    courseId: string;
  };
};

export default function CoursePage({ params }: CoursePageProps) {
  const firestore = useFirestore();
  const courseRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'courses', params.courseId);
  }, [firestore, params.courseId]);

  const { data: courseData, isLoading } = useDoc(courseRef);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!courseData) {
    notFound();
  }
  
  const course: Course = {
      id: courseData.id,
      title: courseData.title,
      description: courseData.description,
      thumbnailUrl: courseData.thumbnailUrl,
      thumbnailHint: `course ${courseData.id}`,
      targetClass: courseData.targetClass,
      chapters: courseData.chapters,
      instructor: {
        name: courseData.instructorName || 'Instructor',
        avatarUrl: courseData.instructorAvatarUrl || `https://picsum.photos/seed/${courseData.instructorId}/40/40`,
      }
  };

  return <CourseView course={course} />;
}
