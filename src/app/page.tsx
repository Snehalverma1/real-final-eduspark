'use client';

import { useState } from 'react';
import { CourseCard } from "@/components/course-card";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Award, BookOpen, Users, TrendingUp } from "lucide-react";
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Course as CourseType } from "@/lib/data";
import { categories } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Home() {
  const firestore = useFirestore();
  const { user, isUserLoading: isUserAuthLoading } = useUser();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isUserAuthLoading) return null;

    let baseQuery = collection(firestore, 'courses');
    
    if (selectedCategory !== "All") {
      return query(baseQuery, where('status', '==', 'Published'), where('category', '==', selectedCategory));
    }
    
    return query(baseQuery, where('status', '==', 'Published'));
  }, [firestore, isUserAuthLoading, selectedCategory]);

  const { data: courses, isLoading: areCoursesLoading } = useCollection(coursesQuery);
  
  const isLoading = isUserAuthLoading || (!!coursesQuery && areCoursesLoading);

  const formattedCourses: CourseType[] = (courses || [])
    .map((course: any) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category || "General",
      thumbnailUrl: course.thumbnailUrl,
      thumbnailHint: `course ${course.id}`,
      chapters: course.chapters || [],
      instructor: {
        name: course.instructorName || 'Instructor',
        avatarUrl: course.instructorAvatarUrl || `https://picsum.photos/seed/${course.instructorId}/40/40`,
      }
    }))
    .filter(course => 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-background hero-gradient">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 animate-in fade-in slide-in-from-bottom-3">
            <Award className="h-4 w-4" />
            #1 Trusted Platform for Govt Exams
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-headline tracking-tighter text-foreground mb-6 leading-none">
            Ignite Your Career in <br />
            <span className="text-primary">Government Services</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-muted-foreground leading-relaxed">
            Expert-led courses for SSC, Banking, Railways, and more. <br />
            Learn from the best, clear the rest.
          </p>
          
          <div className="mt-12 max-w-2xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center bg-card rounded-xl shadow-2xl border p-1 overflow-hidden">
              <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for SSC CGL, Bank PO, RRB NTPC..." 
                className="pl-12 h-14 text-lg border-none focus-visible:ring-0 shadow-none flex-1" 
              />
              <Button size="lg" className="h-12 px-8 font-bold hidden md:flex">Search Courses</Button>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16 opacity-70">
            <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent" /><span className="font-medium">95% Success Rate</span></div>
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" /><span className="font-medium">50K+ Aspirants</span></div>
            <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-accent" /><span className="font-medium">200+ Expert Classes</span></div>
          </div>
        </div>
      </section>

      {/* Category Bar */}
      <section className="sticky top-14 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 border",
                  selectedCategory === cat 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                    : "bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="container mx-auto p-4 md:p-8 pt-12 pb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold font-headline">Latest Exam Courses</h2>
            <p className="text-muted-foreground mt-2">Hand-picked premium content for your success</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-4 animate-pulse">
                <div className="h-56 bg-muted rounded-2xl w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : formattedCourses && formattedCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {formattedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">No courses found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </section>

      {/* Trust Section */}
      <section className="bg-primary/5 py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-headline mb-4">Start Your Prep Today</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">Join thousands of students who have already achieved their dream jobs with EduSpark's expert guidance.</p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="rounded-full px-10 h-14 text-lg">Browse All Exams</Button>
            <Button size="lg" variant="outline" className="rounded-full px-10 h-14 text-lg bg-transparent">Watch Demo Class</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
