import { courses } from "@/lib/data";
import { notFound } from "next/navigation";
import CourseView from "@/components/course-view";

type CoursePageProps = {
  params: {
    courseId: string;
  };
};

export default function CoursePage({ params }: CoursePageProps) {
  const course = courses.find((c) => c.id === params.courseId);

  if (!course) {
    notFound();
  }

  return <CourseView course={course} />;
}
