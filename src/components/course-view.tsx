"use client";

import { useState, useMemo, useEffect } from "react";
import type { Course, Lecture } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Lock, Sparkles, BookOpen, VideoOff, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import AiQaPanel from "./ai-qa-panel";
import { ScrollArea } from "./ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import Link from "next/link";

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
                                        const isLocked = false;

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
  const firestore = useFirestore();

  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !course.id) return null;
    return doc(firestore, 'courses', course.id, 'liveSessions', 'active_session');
  }, [firestore, course.id]);

  const { data: sessionData } = useDoc(sessionRef);
  const isLive = sessionData?.status === 'active';
  
  const { totalLectures, firstLecture } = useMemo(() => {
    const lectures: Lecture[] = course.chapters.flatMap(c => c.lectures);
    return {
        totalLectures: lectures.length,
        firstLecture: lectures[0] || null
    };
  }, [course.chapters]);
  
  useEffect(() => {
    if (firstLecture && !activeLecture) {
      setActiveLecture(firstLecture);
    }
  }, [firstLecture, activeLecture]);

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

  const getVideoEmbedUrl = (url: string): string => {
    if (!url) return "";
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&title=0&byline=0&portrait=0`;
    }
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch && youtubeMatch[1]) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    return url;
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
        {isLive && (
          <Link href={`/courses/${course.id}/live`}>
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4 transition-all hover:bg-red-500/20 group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Radio className="h-5 w-5 text-red-500" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </div>
                <div>
                  <p className="font-bold text-red-600">LIVE CLASS ONGOING</p>
                  <p className="text-sm text-red-600/80">Join the teacher for a real-time interactive session.</p>
                </div>
              </div>
              <Button className="bg-red-600 hover:bg-red-700 text-white shadow-lg group-hover:scale-105 transition-transform">Join Now</Button>
            </div>
          </Link>
        )}

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
                    <div className="flex gap-2">
                      <Button asChild variant="secondary" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
                        <Link href={`/courses/${course.id}/live`}>
                          <Radio className="mr-2 h-4 w-4" /> Live Room
                        </Link>
                      </Button>
                      {activeLecture.type === 'text' && (
                        <Button onClick={() => setIsQaPanelOpen(true)}>
                            <Sparkles className="mr-2 h-4 w-4" /> Ask AI
                        </Button>
                      )}
                    </div>
                </div>
                
                {activeLecture.type === 'video' ? (
                <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black shadow-lg">
                    <iframe
                    key={activeLecture.id}
                    className="w-full h-full"
                    src={getVideoEmbedUrl(activeLecture.content)}
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
