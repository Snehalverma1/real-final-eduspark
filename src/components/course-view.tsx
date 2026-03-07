"use client";

import { useState, useMemo, useEffect } from "react";
import type { Course, Lesson } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import AiQaPanel from "./ai-qa-panel";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";

export default function CourseView({ course }: { course: Course }) {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isQaPanelOpen, setIsQaPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setActiveLesson(course.lessons[0]);
  }, [course.lessons]);

  const progress = useMemo(() => {
    if (!hydrated) return 0;
    return (completedLessons.size / course.lessons.length) * 100;
  }, [completedLessons, course.lessons.length, hydrated]);

  const toggleLessonComplete = (lessonId: string) => {
    setCompletedLessons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  if (!hydrated || !activeLesson) {
    return (
        <div className="grid md:grid-cols-[350px_1fr] min-h-[calc(100vh-4rem)]">
          <aside className="border-r bg-card hidden md:flex flex-col p-4 gap-4">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex items-center gap-3 mt-3">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="flex flex-col gap-2 mt-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          </aside>
          <main className="p-4 md:p-8">
            <Skeleton className="h-12 w-full max-w-lg mb-4" />
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-28" />
            </div>
            <Skeleton className="aspect-video w-full rounded-lg" />
          </main>
        </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[350px_1fr] min-h-[calc(100vh-4rem)]">
      <aside className="border-r bg-card hidden md:flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold font-headline">{course.title}</h2>
          <div className="flex items-center gap-3 mt-3">
            <Progress value={progress} className="h-2" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-4">
            {course.lessons.map((lesson) => {
              const isCompleted = completedLessons.has(lesson.id);
              const isActive = activeLesson.id === lesson.id;
              const isLocked = false; // Logic for locked lessons can be added here

              return (
                <button
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  disabled={isLocked}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors flex items-start gap-4 text-sm",
                    "disabled:text-muted-foreground disabled:cursor-not-allowed",
                    isActive ? "bg-primary/10 text-primary-foreground" : "hover:bg-accent/50",
                    isActive && "font-semibold"
                  )}
                >
                  <div className="mt-1">
                    {isLocked ? <Lock className="h-4 w-4 shrink-0" /> : isCompleted ? <CheckCircle className="h-4 w-4 shrink-0 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 bg-background border-muted-foreground/50 shrink-0" />}
                  </div>
                  <div className="flex flex-col">
                      <span>{lesson.title}</span>
                      <span className={cn("text-xs", isActive ? "text-primary/80" : "text-muted-foreground")}>{lesson.duration} min</span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <main className="p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold font-headline mb-2">{activeLesson.title}</h1>
        <div className="flex items-center justify-between mb-6">
            <Button onClick={() => toggleLessonComplete(activeLesson.id)} variant="outline">
              <CheckCircle className={cn("mr-2 h-4 w-4", completedLessons.has(activeLesson.id) && "text-green-500")} />
              {completedLessons.has(activeLesson.id) ? 'Marked as Complete' : 'Mark as Complete'}
            </Button>
            {activeLesson.type === 'text' && (
              <Button onClick={() => setIsQaPanelOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Ask AI
              </Button>
            )}
        </div>
        
        {activeLesson.type === 'video' ? (
          <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black shadow-lg">
            <iframe
              key={activeLesson.id}
              className="w-full h-full"
              src={activeLesson.content}
              title="Course video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <ScrollArea className="h-[60vh]">
            <div className="bg-card p-6 rounded-lg border leading-relaxed text-base whitespace-pre-line">
              {activeLesson.content}
            </div>
          </ScrollArea>
        )}
      </main>

      <AiQaPanel
        isOpen={isQaPanelOpen}
        setIsOpen={setIsQaPanelOpen}
        courseMaterial={activeLesson.type === 'text' ? activeLesson.content : 'This is a video lesson. Q&A is only available for text-based content.'}
      />
    </div>
  );
}
