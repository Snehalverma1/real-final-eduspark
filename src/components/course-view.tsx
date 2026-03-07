"use client";

import { useState, useMemo, useEffect } from "react";
import type { Course, Lecture, Chapter } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Lock, Sparkles, BookOpen, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import AiQaPanel from "./ai-qa-panel";
import { ScrollArea } from "./ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function CourseSidebar({ course, progress, completedLectures, activeLecture, setActiveLecture }: { course: Course, progress: number, completedLectures: Set<string>, activeLecture: Lecture | null, setActiveLecture: (l: Lecture) => void }) {
    return (
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
                                        <BookOpen className="h-5 w-5 text-primary" />
                                        <span>{chapter.title}</span>
                                    </div>
                                </AccordionTrigger>
                            </div>
                            <AccordionContent className="p-0">
                                <div className="flex flex-col gap-1 p-2">
                                    {chapter.lectures.map((lecture) => {
                                        const isCompleted = completedLectures.has(lecture.id);
                                        const isActive = activeLecture?.id === lecture.id;
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
    );
}

export default function CourseView({ course }: { course: Course }) {
  const [completedLectures, setCompletedLectures] = useState<Set<string>>(new Set());
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [isQaPanelOpen, setIsQaPanelOpen] = useState(false);
  
  const { totalLectures, firstLecture } = useMemo(() => {
    const lectures: Lecture[] = course.chapters.flatMap(c => c.lectures);
    return {
        totalLectures: lectures.length,
        firstLecture: lectures[0] || null
    };
  }, [course.chapters]);
  
  useEffect(() => {
    // Set the first lecture as active when the component mounts or the course changes.
    if (firstLecture) {
      setActiveLecture(firstLecture);
    } else {
      setActiveLecture(null);
    }
  }, [firstLecture]);

  const progress = useMemo(() => {
    if (totalLectures === 0) return 0;
    return (completedLectures.size / totalLectures) * 100;
  }, [completedLectures.size, totalLectures]);

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

  return (
    <div className="grid md:grid-cols-[350px_1fr] min-h-[calc(100vh-4rem)]">
      <CourseSidebar 
        course={course}
        progress={progress}
        completedLectures={completedLectures}
        activeLecture={activeLecture}
        setActiveLecture={setActiveLecture}
      />

      <main className="p-4 md:p-8">
        {!activeLecture ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <VideoOff className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-2xl font-semibold">No lecture selected</h2>
                <p className="mt-2 text-muted-foreground">
                    {totalLectures > 0 ? 'Select a lecture from the sidebar to begin.' : 'This course has no lectures yet.'}
                </p>
            </div>
        ) : (
            <>
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
            </>
        )}
      </main>

      {activeLecture && <AiQaPanel
        isOpen={isQaPanelOpen}
        setIsOpen={setIsQaPanelOpen}
        courseMaterial={activeLecture.type === 'text' ? activeLecture.content : 'This is a video lesson. Q&A is only available for text-based content.'}
      />}
    </div>
  );
}
