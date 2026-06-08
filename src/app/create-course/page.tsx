
"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Trash2, Book, Film, Loader2, ShieldAlert, Layers, Sparkles, Image as ImageIcon, ClipboardList, CheckCircle2, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, collection, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { categories } from "@/lib/data";

const questionSchema = z.object({
  question: z.string().min(5, "Question text is required."),
  options: z.array(z.string().min(1, "Option is required.")).length(4, "Exactly 4 options required."),
  correctAnswerIndex: z.coerce.number().min(0).max(3),
});

const testSchema = z.object({
  title: z.string().min(5, "Test title is required."),
  durationMinutes: z.coerce.number().min(1, "Duration required."),
  questions: z.array(questionSchema).min(1, "At least one question required."),
});

const lectureSchema = z.object({
  lectureNumber: z.coerce.number().min(1, "Lecture number is required."),
  title: z.string().min(3, "Lecture title must be at least 3 characters."),
  type: z.enum(["video", "text"], { required_error: "Please select a type."}),
  content: z.string().min(5, "Content (URL or Text) is required."),
  summary: z.string().min(10, "Summary/Notes for AI context is required.").describe("AI uses this to answer questions about the video."),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute."),
});

const chapterSchema = z.object({
  title: z.string().min(3, "Chapter title must be at least 3 characters."),
  lectures: z.array(lectureSchema).min(1, "At least one lecture is required per chapter."),
});

const courseSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(20, "Description must be at least 20 characters."),
  category: z.string({ required_error: "Please select an exam category." }),
  thumbnailUrl: z.string().optional(),
  difficultyLevel: z.enum(['Beginner', 'Intermediate', 'Advanced'], { required_error: "Please select a difficulty level." }),
  chapters: z.array(chapterSchema).min(1, "At least one chapter is required."),
  tests: z.array(testSchema).optional(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

export default function CreateCoursePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      thumbnailUrl: "",
      difficultyLevel: "Beginner",
      chapters: [{ title: "Chapter 1", lectures: [{ lectureNumber: 1, title: "", type: "video", content: "", summary: "", duration: 15 }] }],
      tests: [],
    },
  });

  const { fields: chapterFields, append: appendChapter, remove: removeChapter } = useFieldArray({
    control: form.control,
    name: "chapters",
  });

  const { fields: testFields, append: appendTest, remove: removeTest } = useFieldArray({
    control: form.control,
    name: "tests",
  });
  
  const { isSubmitting } = form.formState;
  const isBusy = isSubmitting || isSaving;
  const isLoading = isUserLoading || isProfileLoading;

  function onSubmit(data: CourseFormValues) {
    if (!user || !firestore) return;
    setIsSaving(true);

    const courseId = doc(collection(firestore, 'courses')).id;
    const courseRef = doc(firestore, `courses`, courseId);

    const finalCourseData = {
      ...data,
      id: courseId,
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      instructorAvatarUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/40/40`,
      status: 'Published' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnailUrl: data.thumbnailUrl || `https://picsum.photos/seed/${courseId}/600/400`,
    };

    setDoc(courseRef, finalCourseData)
      .then(() => {
        toast({ title: "Course Published!" });
        router.push('/');
      })
      .catch((error: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: courseRef.path, operation: 'create', requestResourceData: finalCourseData }));
      })
      .finally(() => setIsSaving(false));
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">Publish New Program</h1>
        <p className="text-muted-foreground mt-1">Design a world-class curriculum for Scholars aspirants.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
          {/* General Information Card */}
          <Card className="rounded-3xl border-primary/10 shadow-xl overflow-hidden">
            <CardHeader className="bg-primary/5 p-8 border-b">
              <CardTitle className="flex items-center gap-2"><Layers className="text-primary h-6 w-6" /> General Information</CardTitle>
              <CardDescription>Basic details about your exam-oriented course.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Title</FormLabel>
                  <FormControl><Input placeholder="e.g., SSC CGL 2024: Quantitative Aptitude Masterclass" className="h-12" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Target Exam" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.filter(c => c !== "All").map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="difficultyLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner (Concept Foundation)</SelectItem>
                        <SelectItem value="Intermediate">Intermediate (Problem Solving)</SelectItem>
                        <SelectItem value="Advanced">Advanced (Rank Booster)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="thumbnailUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> 
                    Course Thumbnail URL (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://images.unsplash.com/photo-..." className="h-12" {...field} />
                  </FormControl>
                  <FormDescription>
                    Paste an image link for your cover. If left blank, we'll generate a professional placeholder.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Overview</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the curriculum, strategy, and selection goal..." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Curriculum Builder Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold font-headline flex items-center gap-2"><Book className="text-primary h-6 w-6" /> Curriculum Builder</h2>
            {chapterFields.map((chapter, index) => <ChapterForm key={chapter.id} chapterIndex={index} form={form} removeChapter={removeChapter} />)}
            <Button type="button" variant="outline" onClick={() => appendChapter({ title: "New Chapter", lectures: [{ lectureNumber: 1, title: "", type: "video", content: "", summary: "", duration: 15 }] })} className="w-full h-14 border-dashed border-2 rounded-2xl">
              <PlusCircle className="mr-2 h-5 w-5" /> Add New Chapter
            </Button>
          </div>

          {/* Test & Assessment Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-headline flex items-center gap-2"><ClipboardList className="text-accent h-6 w-6" /> Mock Tests & Assessments</h2>
              <Badge variant="outline" className="border-accent text-accent">Exam Feature</Badge>
            </div>
            {testFields.map((test, index) => <TestForm key={test.id} testIndex={index} form={form} removeTest={removeTest} />)}
            <Button type="button" variant="outline" onClick={() => appendTest({ title: "New Mock Test", durationMinutes: 60, questions: [{ question: "", options: ["", "", "", ""], correctAnswerIndex: 0 }] })} className="w-full h-14 border-dashed border-2 rounded-2xl border-accent/20 hover:border-accent/50 hover:bg-accent/5">
              <PlusCircle className="mr-2 h-5 w-5 text-accent" /> Add Sectional Mock Test
            </Button>
          </div>

          {/* Action Footer */}
          <div className="pt-8 border-t flex flex-col md:flex-row gap-4">
             <Button variant="ghost" type="button" onClick={() => router.back()} className="h-14 px-8 font-bold">Cancel</Button>
             <Button type="submit" disabled={isBusy} className="flex-1 h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20">
                {isBusy ? (
                    <><Loader2 className="animate-spin mr-2" /> Publishing your Program...</>
                ) : (
                    <><CheckCircle2 className="mr-2 h-5 w-5" /> Publish Course & Tests</>
                )}
             </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function ChapterForm({ chapterIndex, form, removeChapter }: any) {
  const { fields: lectureFields, append: appendLecture, remove: removeLecture } = useFieldArray({
    control: form.control,
    name: `chapters.${chapterIndex}.lectures`,
  });

  return (
    <Card className="rounded-3xl border-primary/5 shadow-lg overflow-hidden">
      <CardHeader className="bg-muted/30 p-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
            <Badge variant="secondary" className="rounded-lg px-2">CH {chapterIndex + 1}</Badge>
            <FormField control={form.control} name={`chapters.${chapterIndex}.title`} render={({ field }) => (
                <FormControl><Input {...field} className="bg-transparent border-none font-bold text-lg shadow-none focus-visible:ring-0 p-0 h-auto" placeholder="Chapter Title..." /></FormControl>
            )} />
        </div>
        <Button size="icon" variant="ghost" type="button" onClick={() => removeChapter(chapterIndex)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {lectureFields.map((lecture, lIdx) => (
          <div key={lecture.id} className="p-4 bg-background border rounded-2xl space-y-4 group transition-all hover:border-primary/20">
            <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Lecture {lIdx+1}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLecture(lIdx)} className="h-8 w-8 rounded-full"><Trash2 className="h-3 w-3"/></Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`chapters.${chapterIndex}.lectures.${lIdx}.title`} render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Lecture Title</FormLabel><FormControl><Input placeholder="Topic Name..." {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`chapters.${chapterIndex}.lectures.${lIdx}.duration`} render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Duration (Min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                )} />
            </div>

            <FormField control={form.control} name={`chapters.${chapterIndex}.lectures.${lIdx}.content`} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold flex items-center gap-1"><Globe className="h-3 w-3" /> Video / Content URL</FormLabel>
                    <FormControl><Input placeholder="YouTube / Vimeo / Text..." {...field} /></FormControl>
                    <FormDescription className="text-[10px]">Enter a URL for video lessons or the full lecture text.</FormDescription>
                </FormItem>
            )} />

            <FormField control={form.control} name={`chapters.${chapterIndex}.lectures.${lIdx}.summary`} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> AI Study Notes & Summary</FormLabel>
                    <FormControl><Textarea placeholder="Key highlights, formulas, or transcription for the AI..." className="min-h-[80px]" {...field} /></FormControl>
                    <FormDescription className="text-[10px]">Critical for the AI assistant to provide high-quality context to students.</FormDescription>
                </FormItem>
            )} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => appendLecture({ lectureNumber: lectureFields.length + 1, title: "", type: "video", content: "", summary: "", duration: 15 })} className="w-full border-dashed border py-6">+ Add Lecture to Chapter</Button>
      </CardContent>
    </Card>
  );
}

function TestForm({ testIndex, form, removeTest }: any) {
  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: `tests.${testIndex}.questions`,
  });

  return (
    <Card className="rounded-3xl border-accent/10 shadow-xl overflow-hidden bg-accent/5">
      <CardHeader className="p-6 flex flex-row items-center justify-between border-b border-accent/10">
        <div className="flex items-center gap-4 flex-1">
            <Badge className="bg-accent text-accent-foreground font-black">TEST {testIndex + 1}</Badge>
            <FormField control={form.control} name={`tests.${testIndex}.title`} render={({ field }) => (
                <FormControl><Input {...field} className="bg-transparent border-none font-bold text-lg shadow-none focus-visible:ring-0 p-0 h-auto" placeholder="Mock Test Title (e.g., Geometry Sectional 01)" /></FormControl>
            )} />
        </div>
        <div className="flex items-center gap-4">
            <FormField control={form.control} name={`tests.${testIndex}.durationMinutes`} render={({ field }) => (
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold whitespace-nowrap">Time (Min):</span>
                    <FormControl><Input type="number" {...field} className="w-16 h-8 text-center" /></FormControl>
                </div>
            )} />
            <Button size="icon" variant="ghost" type="button" onClick={() => removeTest(testIndex)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {questionFields.map((q, qIdx) => (
          <div key={q.id} className="p-5 bg-background rounded-2xl border-2 border-accent/5 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase text-accent tracking-tighter">Question {qIdx + 1}</span>
                <Button variant="ghost" size="sm" type="button" onClick={() => removeQuestion(qIdx)} className="h-8 w-8 rounded-full"><Trash2 className="h-3 w-3"/></Button>
            </div>
            
            <FormField control={form.control} name={`tests.${testIndex}.questions.${qIdx}.question`} render={({ field }) => (
                <FormControl><Input placeholder="Question text..." className="h-12 border-none bg-muted/30" {...field} /></FormControl>
            )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {[0, 1, 2, 3].map(optIdx => (
                <FormField key={optIdx} control={form.control} name={`tests.${testIndex}.questions.${qIdx}.options.${optIdx}`} render={({ field }) => (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/20 border border-transparent focus-within:border-accent/20">
                    <FormField control={form.control} name={`tests.${testIndex}.questions.${qIdx}.correctAnswerIndex`} render={({ field: radioField }) => (
                      <input type="radio" className="h-4 w-4 accent-accent" checked={radioField.value === optIdx} onChange={() => radioField.onChange(optIdx)} />
                    )} />
                    <FormControl><Input placeholder={`Option ${optIdx + 1}`} className="border-none bg-transparent h-8 shadow-none focus-visible:ring-0" {...field} /></FormControl>
                  </div>
                )} />
              ))}
            </div>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => appendQuestion({ question: "", options: ["", "", "", ""], correctAnswerIndex: 0 })} className="w-full py-6 border-accent/20 border-dashed border">+ Add MCQ Question</Button>
      </CardContent>
    </Card>
  );
}
