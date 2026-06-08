
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Course, Lecture, Test } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Lock, Sparkles, BookOpen, VideoOff, Radio, FileText, ClipboardList, Loader2, ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import AiQaPanel from "./ai-qa-panel";
import { ScrollArea } from "./ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFirestore, useDoc, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function CourseSidebar({ course, progress, completedLectures, activeLecture, setActiveLecture }: { course: Course, progress: number, completedLectures: Set<string>, activeLecture: Lecture | null, setActiveLecture: (l: Lecture) => void }) {
    return (
        <aside className="border-r bg-card hidden md:flex flex-col">
            <div className="p-4 border-b">
                <h2 className="text-xl font-bold font-headline line-clamp-2">{course.title}</h2>
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
                                        return (
                                            <button
                                                key={lecture.id}
                                                onClick={() => setActiveLecture(lecture)}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 text-sm",
                                                    isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50",
                                                )}
                                            >
                                                <div className="mt-1">
                                                    {isCompleted ? <CheckCircle className="h-4 w-4 shrink-0 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 bg-background border-muted-foreground/50 shrink-0" />}
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
  const { user } = useUser();
  const firestore = useFirestore();
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [isQaPanelOpen, setIsQaPanelOpen] = useState(false);

  const enrollmentRef = useMemoFirebase(() => {
    if (!firestore || !user || !course.id) return null;
    return doc(firestore, 'userProfiles', user.uid, 'enrollments', course.id);
  }, [firestore, user, course.id]);

  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc(enrollmentRef);

  const completedLectures = useMemo(() => new Set<string>(enrollment?.completedLectures || []), [enrollment]);

  const { totalLectures, firstLecture } = useMemo(() => {
    const lectures: Lecture[] = (course.chapters || []).flatMap(c => c.lectures || []);
    return { totalLectures: lectures.length, firstLecture: lectures[0] || null };
  }, [course.chapters]);
  
  useEffect(() => { if (firstLecture && !activeLecture) setActiveLecture(firstLecture); }, [firstLecture, activeLecture]);

  const progress = useMemo(() => totalLectures === 0 ? 0 : (completedLectures.size / totalLectures) * 100, [completedLectures.size, totalLectures]);

  const toggleLectureComplete = (lectureId: string) => {
    if (!enrollmentRef || !user) return;
    const currentCompleted = Array.from(completedLectures);
    const newCompleted = completedLectures.has(lectureId) ? currentCompleted.filter(id => id !== lectureId) : [...currentCompleted, lectureId];
    updateDocumentNonBlocking(enrollmentRef, { completedLectures: newCompleted, updatedAt: serverTimestamp() });
  };

  const handleEnroll = () => {
    if (!enrollmentRef || !user) return;
    setDocumentNonBlocking(enrollmentRef, { userId: user.uid, courseId: course.id, completedLectures: [], enrolledAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  };

  if (isEnrollmentLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;

  if (!enrollment && user) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center max-w-2xl mx-auto">
              <BookOpen className="h-16 w-16 text-primary mb-6" />
              <h1 className="text-4xl font-bold font-headline mb-4">{course.title}</h1>
              <p className="text-muted-foreground text-lg mb-8">Join this course to access lectures, materials, and track your success.</p>
              <Button onClick={handleEnroll} size="lg" className="w-full h-16 rounded-2xl font-bold shadow-xl">Enroll Now <ArrowRight className="ml-2" /></Button>
          </div>
      );
  }

  return (
    <div className="grid md:grid-cols-[350px_1fr] min-h-[calc(100vh-4rem)]">
      <CourseSidebar course={course} progress={progress} completedLectures={completedLectures} activeLecture={activeLecture} setActiveLecture={setActiveLecture} />
      <main className="p-4 md:p-8">
        <Tabs defaultValue="lecture" className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-xl mb-6">
                <TabsTrigger value="lecture"><BookOpen className="mr-2 h-4 w-4" /> Lecture</TabsTrigger>
                <TabsTrigger value="materials"><FileText className="mr-2 h-4 w-4" /> Materials</TabsTrigger>
                <TabsTrigger value="tests"><ClipboardList className="mr-2 h-4 w-4" /> Mock Tests</TabsTrigger>
            </TabsList>
            <TabsContent value="lecture">
                {activeLecture && (
                    <div className="grid gap-6">
                        <h1 className="text-3xl font-bold">{activeLecture.title}</h1>
                        {activeLecture.type === 'video' ? (
                            <div className="aspect-video bg-black rounded-2xl overflow-hidden border">
                                <iframe className="w-full h-full" src={activeLecture.content.includes('youtube') ? activeLecture.content.replace('watch?v=', 'embed/') : activeLecture.content} allowFullScreen></iframe>
                            </div>
                        ) : <div className="p-8 border rounded-2xl bg-card whitespace-pre-line">{activeLecture.content}</div>}
                        <Card className="bg-primary/5">
                            <CardContent className="p-6">
                                <p className="font-bold flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4" /> AI Lesson Notes</p>
                                <p className="text-sm text-muted-foreground">{activeLecture.summary || "Study notes pending."}</p>
                                <Button onClick={() => setIsQaPanelOpen(true)} className="mt-4">Ask AI Assistant</Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </TabsContent>
            <TabsContent value="materials">
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p>Chapter notes and practice PDFs will appear here.</p>
                </div>
            </TabsContent>
            <TabsContent value="tests">
                <div className="grid gap-4">
                    {course.tests && course.tests.length > 0 ? (
                        course.tests.map((test) => (
                            <div key={test.id} className="p-6 border rounded-2xl bg-card flex justify-between items-center group hover:border-primary/50 transition-all">
                                <div>
                                    <h3 className="text-xl font-bold">{test.title}</h3>
                                    <p className="text-sm text-muted-foreground">{test.questions.length} Questions • {test.durationMinutes} Minutes</p>
                                    {enrollment?.testResults?.[test.id] !== undefined && (
                                        <Badge className="mt-2" variant="secondary">Last Score: {enrollment.testResults[test.id]}%</Badge>
                                    )}
                                </div>
                                <Button asChild className="rounded-xl shadow-lg shadow-primary/10">
                                    <Link href={`/courses/${course.id}/tests/${test.id}`}>Start Mock Test</Link>
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p>No mock tests available for this program yet.</p>
                        </div>
                    )}
                </div>
            </TabsContent>
        </Tabs>
      </main>
      {activeLecture && <AiQaPanel isOpen={isQaPanelOpen} setIsOpen={setIsQaPanelOpen} courseMaterial={activeLecture.summary || ""} />}
    </div>
  );
}
