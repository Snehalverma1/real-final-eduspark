
'use client';

import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { PlusCircle, Loader2, BookOpen, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const teacherCoursesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courses'), where('instructorId', '==', user.uid));
  }, [firestore, user]);

  const { data: courses, isLoading: areCoursesLoading } = useCollection(teacherCoursesQuery);

  const isLoading = isUserLoading || isProfileLoading;
  const isTeacher = userProfile?.role === 'class-teacher' || userProfile?.role === 'subject-teacher';
  const isApproved = userProfile?.applicationStatus === 'approved';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !isTeacher) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold font-headline">Access Denied</h1>
        <p className="text-muted-foreground mt-2">This dashboard is for teachers only.</p>
        <Button asChild className="mt-4"><Link href="/">Back to Home</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-headline">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your courses and interact with students.</p>
        </div>
        {isApproved ? (
          <Button asChild size="lg">
            <Link href="/create-course">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Course
            </Link>
          </Button>
        ) : (
          <Badge variant="outline" className="px-4 py-2 text-sm bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            Account Approval Pending
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Class Status</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Offline</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Application</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{userProfile?.applicationStatus}</div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold font-headline mb-4">Your Courses</h2>
      {areCoursesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-all">
              <div className="relative h-40 bg-muted">
                <img 
                  src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/400/200`} 
                  alt={course.title} 
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-2 right-2" variant={course.status === 'Published' ? 'default' : 'secondary'}>
                  {course.status}
                </Badge>
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-lg line-clamp-1">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href={`/courses/${course.id}`}>View</Link>
                </Button>
                <Button asChild size="sm" variant="secondary" className="flex-1">
                   <Link href={`/courses/${course.id}/live`}>Go Live</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed py-12 text-center">
          <CardContent>
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">You haven't created any courses yet.</p>
            {isApproved && (
              <Button asChild className="mt-4">
                <Link href="/create-course">Get Started</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
