'use client';

import { useState } from 'react';
import { CourseCard } from "@/components/course-card";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Award, BookOpen, Users, TrendingUp, Sparkles, Bell, Calendar, ChevronRight } from "lucide-react";
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Course as CourseType } from "@/lib/data";
import { categories } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

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

  const examAlerts = [
    { title: "SSC CGL 2024 Tier-1 Result Out", tag: "New", color: "text-red-500" },
    { title: "IBPS PO Phase-II Admit Card Released", tag: "Update", color: "text-blue-500" },
    { title: "RRB NTPC Exam Date Notification", tag: "Alert", color: "text-orange-500" },
    { title: "UPSC Prelims 2025 Calendar Released", tag: "Calendar", color: "text-green-500" },
  ];

  return (
    <div className="min-h-screen bg-background hero-gradient">
      {/* Dynamic Exam Alert Ticker */}
      <div className="bg-foreground text-background py-2 overflow-hidden border-b border-white/10">
        <div className="container mx-auto px-4 flex items-center gap-6">
          <div className="flex items-center gap-2 whitespace-nowrap bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shrink-0 animate-pulse">
            <Bell className="h-3 w-3" />
            Live Alerts
          </div>
          <div className="flex gap-12 animate-infinite-scroll overflow-x-hidden whitespace-nowrap text-xs font-medium opacity-80 py-1">
            {examAlerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={cn("font-bold", alert.color)}>[{alert.tag}]</span>
                <span>{alert.title}</span>
                <span className="opacity-20">|</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Premium Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-24 md:pb-32 border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Award className="h-4 w-4" />
              <span>India's Most Trusted Learning Ecosystem for Civil & Govt. Services</span>
            </div>
            
            <h1 className="text-4xl md:text-7xl font-bold font-headline tracking-tighter text-foreground mb-6 leading-[1.1] max-w-5xl">
              Master Your Exams. <br />
              <span className="text-primary relative inline-block">
                Secure Your Future.
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-accent/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="8" />
                </svg>
              </span>
            </h1>
            
            <p className="mt-8 max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
              Join elite educators to crack SSC CGL, Bank PO, Railways, and UPSC. 
              Our AI-integrated curriculum ensures you stay ahead of the curve with real-time analytics and personalized live sessions.
            </p>
            
            {/* Professional Search Hub */}
            <div className="mt-12 w-full max-w-3xl mx-auto relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative flex flex-col md:flex-row items-center bg-card rounded-2xl shadow-2xl border p-2 overflow-hidden backdrop-blur-sm">
                <div className="flex-1 flex items-center w-full px-4">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for SSC CGL, Banking, UPSC Prep..." 
                    className="h-12 md:h-14 text-lg border-none focus-visible:ring-0 shadow-none flex-1 bg-transparent" 
                  />
                </div>
                <div className="h-10 w-px bg-border hidden md:block mx-2" />
                <Button size="lg" className="w-full md:w-auto h-12 md:h-14 px-10 font-bold rounded-xl shadow-lg shadow-primary/20 group-hover:scale-[1.02] transition-transform">
                  Explore Now
                </Button>
              </div>
            </div>

            {/* Elite Stats Grid */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-5xl w-full border-t pt-12">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl md:text-3xl font-bold font-headline">500K+</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-widest">Active Aspirants</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-2xl md:text-3xl font-bold font-headline">94.8%</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-widest">Selection Rate</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-5 w-5 text-accent" />
                  <span className="text-2xl md:text-3xl font-bold font-headline">1,200+</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-widest">Expert Courses</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <span className="text-2xl md:text-3xl font-bold font-headline">AI+</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-widest">Guided Learning</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Category Navigation */}
      <section className="sticky top-14 z-40 bg-background/90 backdrop-blur-xl border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <span className="hidden md:inline-block text-xs font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Target Exam:</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1 justify-start md:justify-center">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 border whitespace-nowrap",
                    selectedCategory === cat 
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 -translate-y-0.5" 
                      : "bg-background text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Course Grid */}
      <section className="container mx-auto p-4 md:p-8 pt-16 pb-32">
        <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-4">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-bold font-headline">Top Rated Curriculums</h2>
            <p className="text-muted-foreground mt-3 text-lg">
              Explore meticulously designed study plans approved by former toppers and subject matter experts.
            </p>
          </div>
          <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 hidden md:flex" asChild>
            <Link href="#exam-calendar">
                <Calendar className="mr-2 h-4 w-4" /> View Exam Calendar
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-6 animate-pulse bg-card p-4 rounded-3xl border border-border/50">
                <div className="h-52 bg-muted rounded-2xl w-full"></div>
                <div className="space-y-3">
                  <div className="h-5 bg-muted rounded-full w-3/4"></div>
                  <div className="h-5 bg-muted rounded-full w-1/2"></div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-8 w-8 rounded-full bg-muted"></div>
                  <div className="h-8 w-24 rounded-full bg-muted"></div>
                </div>
              </div>
            ))}
          </div>
        ) : formattedCourses && formattedCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {formattedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-card/30 rounded-[3rem] border border-dashed border-muted-foreground/20 backdrop-blur-sm">
            <div className="bg-primary/5 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="h-8 w-8 text-primary opacity-40" />
            </div>
            <h3 className="text-2xl font-bold font-headline">No programs matching your search</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Try selecting a broader exam category or check back later for new course releases.</p>
            <Button onClick={() => {setSelectedCategory("All"); setSearchQuery("");}} variant="link" className="mt-4 text-primary font-bold">Clear all filters</Button>
          </div>
        )}
      </section>

      {/* Corporate Trust Footer Section */}
      <section className="bg-foreground text-background py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold font-headline mb-6">Ready to join India's top civil servants?</h2>
              <p className="text-background/60 text-lg mb-10 leading-relaxed">
                Our mobile-first learning experience is designed to fit into your busy schedule. Download the Scholars guide or join a demo live class today.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="rounded-xl px-10 h-14 text-lg font-bold bg-primary hover:bg-primary/90">Get Started Free</Button>
                <Button size="lg" variant="outline" className="rounded-xl px-10 h-14 text-lg font-bold border-background/20 hover:bg-background/10 text-background">View Success Stories</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-8 bg-background/5 border border-background/10 rounded-3xl backdrop-blur-md">
                <h4 className="text-primary font-bold mb-2">SSC CGL</h4>
                <p className="text-sm text-background/50">Target 2024 Prelims and Mains with intensive workshops.</p>
              </div>
              <div className="p-8 bg-background/5 border border-background/10 rounded-3xl backdrop-blur-md">
                <h4 className="text-accent font-bold mb-2">Banking</h4>
                <p className="text-sm text-background/50">Ace IBPS & SBI PO with our speed-math modules.</p>
              </div>
              <div className="p-8 bg-background/5 border border-background/10 rounded-3xl backdrop-blur-md">
                <h4 className="text-green-500 font-bold mb-2">Railways</h4>
                <p className="text-sm text-background/50">Comprehensive RRB NTPC batch starting every Monday.</p>
              </div>
              <div className="p-8 bg-background/5 border border-background/10 rounded-3xl backdrop-blur-md" id="exam-calendar">
                <h4 className="text-purple-500 font-bold mb-2">UPSC</h4>
                <p className="text-sm text-background/50">CSAT and General Studies with daily current affairs.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
