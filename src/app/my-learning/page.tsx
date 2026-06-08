
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, BookOpen, Clock, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyLearningPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [coursesData, setCoursesData] = useState<any[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch real enrollments
  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'userProfiles', user.uid, 'enrollments');
  }, [firestore, user]);

  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection(enrollmentsQuery);

  // Fetch the full course data for each enrollment
  useEffect(() => {
    async function fetchEnrolledCourses() {
      if (!firestore || !enrollments || enrollments.length === 0) {
        setCoursesData([]);
        return;
      }

      setIsCoursesLoading(true);
      try {
        const courseIds = enrollments.map(e => e.courseId);
        // Firestore 'in' query has a limit of 10-30 IDs usually
        const coursesRef = collection(firestore, 'courses');
        const q = query(coursesRef, where('id', 'in', courseIds));
        const snapshot = await getDocs(q);
        const courses = snapshot.docs.map(doc => doc.data());
        setCoursesData(courses);
      } catch (error) {
        console.error("Error fetching enrolled courses:", error);
      } finally {
        setIsCoursesLoading(false);
      }
    }

    fetchEnrolledCourses();
  }, [firestore, enrollments]);

  const stats = useMemo(() => {
      if (!enrollments || enrollments.length === 0) return { totalProgress: 0, totalEnrolled: 0 };
      
      const totalEnrolled = enrollments.length;
      return { totalEnrolled };
  }, [enrollments]);

  if (isUserLoading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold font-headline">Join the Academy</h1>
        <p className="text-muted-foreground mt-2">Please login to see your learning progress.</p>
        <Button asChild className="mt-4 rounded-xl px-8"><Link href="/login">Login Now</Link></Button>
      </div>
    );
  }

  const isLoading = areEnrollmentsLoading || isCoursesLoading;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">My Learning Hub</h1>
        <p className="text-muted-foreground mt-1">Pick up right where you left off, {user.displayName || 'Aspirant'}.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Card className="bg-primary text-white border-none shadow-xl shadow-primary/20 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Courses Enrolled</CardTitle>
            <BookOpen className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEnrolled}</div>
            <p className="text-xs opacity-70 mt-1">Your active curriculum</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-lg rounded-3xl border-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Study Sessions</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground mt-1">Consistency is key!</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-lg rounded-3xl border-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Preparation Status</CardTitle>
            <Trophy className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">On Track</div>
            <p className="text-xs text-muted-foreground mt-1">Ranking highly in your category</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold font-headline mb-6 flex items-center gap-2">
        Continue Your Journey
        <Badge variant="secondary" className="rounded-full">{stats.totalEnrolled}</Badge>
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-[2rem]" />
          ))}
        </div>
      ) : coursesData.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {coursesData.map((course) => {
            const enrollment = enrollments?.find(e => e.courseId === course.id);
            const totalLectures = (course.chapters || []).reduce((acc: number, ch: any) => acc + (ch.lectures?.length || 0), 0);
            const completedCount = enrollment?.completedLectures?.length || 0;
            const progressValue = totalLectures > 0 ? (completedCount / totalLectures) * 100 : 0;

            return (
              <Card key={course.id} className="overflow-hidden group hover:shadow-2xl transition-all duration-500 rounded-[2rem] border-primary/5">
                <div className="relative h-40 bg-muted overflow-hidden">
                  <img 
                    src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/400/200`} 
                    alt={course.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <Badge className="absolute top-4 left-4 bg-white/90 text-primary border-none font-bold shadow-sm">
                    {course.category}
                  </Badge>
                </div>
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">{course.title}</CardTitle>
                  <div className="flex flex-col gap-1 mt-3">
                     <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span>Progress</span>
                        <span>{Math.round(progressValue)}%</span>
                     </div>
                     <Progress value={progressValue} className="h-1.5" />
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <Button asChild className="w-full rounded-xl shadow-lg shadow-primary/10 h-11">
                    <Link href={`/courses/${course.id}`}>
                      {progressValue > 0 ? "Resume Learning" : "Start Learning"} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed py-20 text-center rounded-[3rem] bg-muted/20">
          <CardContent>
            <BookOpen className="h-20 w-20 text-muted-foreground/30 mx-auto mb-6" />
            <h3 className="text-2xl font-bold font-headline">No Enrolled Courses</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Explore our high-yield exam courses and start your preparation journey today.</p>
            <Button asChild size="lg" className="mt-8 rounded-2xl px-10 h-14 font-bold shadow-xl shadow-primary/20">
                <Link href="/">Browse Programs</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
