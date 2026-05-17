'use client';

import { CourseCard } from "@/components/course-card";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Course as CourseType } from "@/lib/data";

export default function Home() {
  const firestore = useFirestore();
  const { user, isUserLoading: isUserAuthLoading } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    // Don't construct query until we have auth state.
    if (isUserAuthLoading) return null;

    // Show all published courses for everyone (simplified)
    return query(
        collection(firestore, 'courses'), 
        where('status', '==', 'Published')
    );
  }, [firestore, isUserAuthLoading]);

  const { data: courses, isLoading: areCoursesLoading } = useCollection(coursesQuery);
  
  const isLoading = isUserAuthLoading || (user && isProfileLoading) || (!coursesQuery && !!user) || (!!coursesQuery && areCoursesLoading);

  const formattedCourses: CourseType[] = (courses || []).map((course: any) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    thumbnailHint: `course ${course.id}`,
    targetClass: course.targetClass,
    chapters: course.chapters,
    instructor: {
      name: course.instructorName || 'Instructor',
      avatarUrl: course.instructorAvatarUrl || `https://picsum.photos/seed/${course.instructorId}/40/40`,
    }
  }));

  return (
    <div className="container mx-auto p-4 md:p-8">
      <section className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tighter text-primary">
          Ignite Your Learning Journey
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
          Explore a universe of knowledge with courses on everything from Next.js to creative writing. Find your spark.
        </p>
        <div className="mt-8 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input placeholder="Search for courses..." className="pl-10 h-12 text-base" />
        </div>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-bold font-headline mb-8">Available Courses</h2>
        {isLoading ? (
           <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : formattedCourses && formattedCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {formattedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No courses have been published yet.</p>
        )}
      </section>
    </div>
  );
}
