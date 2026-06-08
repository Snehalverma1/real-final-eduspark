"use client";

import { useState, useMemo, useEffect } from "react";
import type { Course, Lecture, Test } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Lock, Sparkles, BookOpen, VideoOff, Radio, FileText, ClipboardList, Loader2, ArrowRight, Trophy } from "lucide-react";
import { cn, getEmbedUrl } from "@/lib/utils";
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h1 className="text-3xl font-bold">{activeLecture.title}</h1>
                            <Button 
                                variant={completedLectures.has(activeLecture.id) ? "outline" : "default"} 
                                onClick={() => toggleLectureComplete(activeLecture.id)}
                                className="rounded-xl"
                            >
                                {completedLectures.has(activeLecture.id) ? (
                                    <><CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Lesson Completed</>
                                ) : (
                                    "Mark as Done"
                                )}
                            </Button>
                        </div>

                        {activeLecture.type === 'video' ? (
                            <div className="aspect-video bg-black rounded-3xl overflow-hidden border shadow-2xl">
                                <iframe 
                                    className="w-full h-full" 
                                    src={getEmbedUrl(activeLecture.content)} 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        ) : (
                            <div className="p-10 border rounded-3xl bg-card whitespace-pre-line text-lg leading-relaxed shadow-sm">
                                {activeLecture.content}
                            </div>
                        )}

                        <Card className="rounded-3xl border-primary/10 bg-primary/5 shadow-none">
                            <CardContent className="p-8">
                                <div className="flex items-center gap-2 mb-4 text-primary font-bold">
                                    <Sparkles className="h-5 w-5" />
                                    <span>AI Study Notes & Insights</span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed italic">
                                    {activeLecture.summary || "Our AI is currently analyzing this lesson. Detailed study notes will appear here soon."}
                                </p>
                                <div className="mt-8 flex gap-4">
                                    <Button onClick={() => setIsQaPanelOpen(true)} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20">
                                        Ask AI Assistant
                                    </Button>
                                    <Button variant="outline" className="rounded-xl h-12 px-6 font-bold">
                                        Download PDF Notes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </TabsContent>
            <TabsContent value="materials">
                <div className="text-center py-20 border-2 border-dashed rounded-[2.5rem] bg-muted/20">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-bold font-headline">Study Resources</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm">Chapter-wise notes, practice questions, and formula sheets will be uploaded here.</p>
                </div>
            </TabsContent>
            <TabsContent value="tests">
                <div className="grid gap-4">
                    {course.tests && course.tests.length > 0 ? (
                        course.tests.map((test) => (
                            <div key={test.id} className="p-8 border rounded-[2rem] bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center group hover:border-primary/50 transition-all shadow-sm">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-bold font-headline">{test.title}</h3>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1"><ClipboardList className="h-4 w-4" /> {test.questions.length} MCQs</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Trophy className="h-4 w-4" /> {test.durationMinutes} Min</span>
                                    </div>
                                    {enrollment?.testResults?.[test.id] !== undefined && (
                                        <Badge className="mt-3 bg-green-50 text-green-700 border-green-200 px-3 py-1 font-bold" variant="secondary">
                                            Latest Performance: {enrollment.testResults[test.id]}%
                                        </Badge>
                                    )}
                                </div>
                                <Button asChild size="lg" className="mt-4 sm:mt-0 rounded-2xl px-10 h-14 font-bold shadow-xl shadow-primary/10">
                                    <Link href={`/courses/${course.id}/tests/${test.id}`}>Start Assessment</Link>
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-[2.5rem] bg-muted/20">
                            <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-bold font-headline">Mock Tests</h3>
                            <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm">Mock tests for this program are being designed. Prepare for the full-length test soon!</p>
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
