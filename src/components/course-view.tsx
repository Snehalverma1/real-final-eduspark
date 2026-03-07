"use client";

import { useState, useMemo, useEffect } from "react";
import type { Course, Lecture, Chapter } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Lock, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import AiQaPanel from "./ai-qa-panel";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function CourseView({ course }: { course: Course }) {
  const [completedLectures, setCompletedLectures] = useState<Set<string>>(new Set());
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [isQaPanelOpen, setIsQaPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const totalLectures = useMemo(() => course.chapters.reduce((sum, chapter) => sum + chapter.lectures.length, 0), [course.chapters]);

  useEffect(() => {
    setHydrated(true);
    if (course.chapters.length > 0 && course.chapters[0].lectures.length > 0) {
      setActiveLecture(course.chapters[0].lectures[0]);
    }
  }, [course.chapters]);

  const progress = useMemo(() => {
    if (!hydrated || totalLectures === 0) return 0;
    return (completedLectures.size / totalLectures) * 100;
  }, [completedLectures, totalLectures, hydrated]);

  const toggleLectureComplete = (lectureId: string) => {
    setCompletedLectures((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lectureId)) {
        newSet.delete(lectureId);
      } else {
        newSet.add(lectureId);
      }
      return newSet;
    });
  };

  if (!hydrated || !activeLecture) {
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
          <Accordion type="multiple" defaultValue={course.chapters.map(c => c.id)} className="w-full">
            {course.chapters.map((chapter) => (
              <AccordionItem value={chapter.id} key={chapter.id} className="border-b-0">
                 <div className="border-b">
                    <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline">
                        <div className="flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-primary"/>
                            <span>{chapter.title}</span>
                        </div>
                    </AccordionTrigger>
                 </div>
                <AccordionContent className="p-0">
                    <div className="flex flex-col gap-1 p-2">
                        {chapter.lectures.map((lecture) => {
                            const isCompleted = completedLectures.has(lecture.id);
                            const isActive = activeLecture.id === lecture.id;
                            const isLocked = false; // Logic for locked lectures can be added here

                            return (
                                <button
                                key={lecture.id}
                                onClick={() => setActiveLecture(lecture)}
                                disabled={isLocked}
                                className={cn(
                                    "w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 text-sm",
                                    "disabled:text-muted-foreground disabled:cursor-not-allowed",
                                    isActive ? "bg-primary/10 text-primary-foreground" : "hover:bg-accent/50",
                                    isActive && "font-semibold"
                                )}
                                >
                                <div className="mt-1">
                                    {isLocked ? <Lock className="h-4 w-4 shrink-0" /> : isCompleted ? <CheckCircle className="h-4 w-4 shrink-0 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 bg-background border-muted-foreground/50 shrink-0" />}
                                </div>
                                <div className="flex flex-col">
                                    <span>{lecture.title}</span>
                                    <span className={cn("text-xs", isActive ? "text-primary/80" : "text-muted-foreground")}>{lecture.duration} min</span>
                                </div>
                                </button>
                            );
                        })}
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </aside>

      <main className="p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold font-headline mb-2">{activeLecture.title}</h1>
        <div className="flex items-center justify-between mb-6">
            <Button onClick={() => toggleLectureComplete(activeLecture.id)} variant="outline">
              <CheckCircle className={cn("mr-2 h-4 w-4", completedLectures.has(activeLecture.id) && "text-green-500")} />
              {completedLectures.has(activeLecture.id) ? 'Marked as Complete' : 'Mark as Complete'}
            </Button>
            {activeLecture.type === 'text' && (
              <Button onClick={() => setIsQaPanelOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Ask AI
              </Button>
            )}
        </div>
        
        {activeLecture.type === 'video' ? (
          <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black shadow-lg">
            <iframe
              key={activeLecture.id}
              className="w-full h-full"
              src={activeLecture.content}
              title="Course video player"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <ScrollArea className="h-[60vh]">
            <div className="bg-card p-6 rounded-lg border leading-relaxed text-base whitespace-pre-line">
              {activeLecture.content}
            </div>
          </ScrollArea>
        )}
      </main>

      <AiQaPanel
        isOpen={isQaPanelOpen}
        setIsOpen={setIsQaPanelOpen}
        courseMaterial={activeLecture.type === 'text' ? activeLecture.content : 'This is a video lesson. Q&A is only available for text-based content.'}
      />
    </div>
  );
}
