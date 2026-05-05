
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LiveClassroom from '@/components/live-classroom';

export default function LivePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const courseRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);

  const { data: course, isLoading: isCourseLoading } = useDoc(courseRef);

  const isLoading = isUserLoading || isCourseLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !course) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">You must be logged in and enrolled to access this live classroom.</p>
        <Button onClick={() => router.push(`/courses/${courseId}`)} className="mt-4">Back to Course</Button>
      </div>
    );
  }

  const isInstructor = user.uid === course.instructorId;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lessons
      </Button>
      
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">{course.title}</h1>
        <p className="text-muted-foreground mt-1">Live Interactive Session</p>
      </div>

      <LiveClassroom courseId={courseId} isInstructor={isInstructor} />
    </div>
  );
}
