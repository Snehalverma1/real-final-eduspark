
'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
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

  // Avoid hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // In a real app, we would have an 'enrollments' collection.
  // For this prototype, we'll show all published courses as "Your Courses"
  const enrolledCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'courses'), where('status', '==', 'Published'));
  }, [firestore]);

  const { data: courses, isLoading: areCoursesLoading } = useCollection(enrolledCoursesQuery);

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
        <Button asChild className="mt-4"><Link href="/login">Login Now</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">My Learning Hub</h1>
        <p className="text-muted-foreground mt-1">Pick up right where you left off, {user.displayName || 'Aspirant'}.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Card className="bg-primary text-white border-none shadow-xl shadow-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Courses Enrolled</CardTitle>
            <BookOpen className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{courses?.length || 0}</div>
            <p className="text-xs opacity-70 mt-1">+2 new this month</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Study Time</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">14.5h</div>
            <p className="text-xs text-muted-foreground mt-1">Target: 20h/week</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Test Success Rate</CardTitle>
            <Trophy className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">82%</div>
            <p className="text-xs text-muted-foreground mt-1">Top 5% in Banking</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold font-headline mb-6 flex items-center gap-2">
        Continue Your Journey
        <Badge variant="secondary" className="rounded-full">{courses?.length || 0}</Badge>
      </h2>

      {areCoursesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden group hover:shadow-2xl transition-all duration-500 rounded-2xl border-primary/5">
              <div className="relative h-40 bg-muted overflow-hidden">
                <img 
                  src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/400/200`} 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <Badge className="absolute top-3 left-3 bg-white/90 text-primary border-none font-bold">
                  {course.category}
                </Badge>
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">{course.title}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                   {/* Using a stable seeded progress based on ID to avoid hydration errors */}
                   <Progress value={45} className="h-1.5" />
                   <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">Progress</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Button asChild size="sm" className="w-full rounded-xl shadow-lg shadow-primary/10">
                  <Link href={`/courses/${course.id}`}>
                    Resume Learning <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed py-16 text-center rounded-[2rem] bg-muted/20">
          <CardContent>
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold font-headline">No Enrolled Courses</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Explore our high-yield exam courses and start your preparation today.</p>
            <Button asChild className="mt-6 rounded-xl px-8">
                <Link href="/">Browse Courses</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
