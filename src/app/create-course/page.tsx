
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, Book, Film, Loader2, ShieldAlert, Layers, Sparkles, Image as ImageIcon, ClipboardList, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <h1 className="text-3xl font-bold font-headline mb-8">Publish New Course</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>General Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="category" render={({ field }) => <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl><SelectContent>{categories.filter(c => c !== "All").map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="difficultyLevel" render={({ field }) => <FormItem><FormLabel>Difficulty</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Beginner">Beginner</SelectItem><SelectItem value="Intermediate">Intermediate</SelectItem><SelectItem value="Advanced">Advanced</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Book /> Chapters</h2>
            {chapterFields.map((chapter, index) => <ChapterForm key={chapter.id} chapterIndex={index} form={form} removeChapter={removeChapter} />)}
            <Button type="button" variant="outline" onClick={() => appendChapter({ title: "", lectures: [{ lectureNumber: 1, title: "", type: "video", content: "", summary: "", duration: 15 }] })} className="w-full">Add Chapter</Button>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardList /> Mock Tests</h2>
            {testFields.map((test, index) => <TestForm key={test.id} testIndex={index} form={form} removeTest={removeTest} />)}
            <Button type="button" variant="outline" onClick={() => appendTest({ title: "", durationMinutes: 60, questions: [{ question: "", options: ["", "", "", ""], correctAnswerIndex: 0 }] })} className="w-full">Add Mock Test</Button>
          </div>

          <Button type="submit" disabled={isBusy} className="w-full h-14 text-lg font-bold">
            {isBusy ? <Loader2 className="animate-spin mr-2" /> : "Publish Course & Tests"}
          </Button>
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
    <Card className="p-4 bg-muted/20">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Chapter {chapterIndex + 1}</h3>
        <Button size="icon" variant="ghost" onClick={() => removeChapter(chapterIndex)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <FormField control={form.control} name={`chapters.${chapterIndex}.title`} render={({ field }) => <FormItem className="mb-4"><FormLabel>Chapter Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
      {lectureFields.map((lecture, lIdx) => (
        <div key={lecture.id} className="p-4 border rounded mb-2 space-y-2">
          <div className="flex justify-between"><span>Lecture {lIdx+1}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeLecture(lIdx)}><Trash2 className="h-4 w-4"/></Button></div>
          <FormField control={form.control} name={`chapters.${chapterIndex}.lectures.${lIdx}.title`} render={({ field }) => <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
          <FormField control={form.control} name={`chapters.${chapterIndex}.lectures.${lIdx}.content`} render={({ field }) => <FormItem><FormLabel>Content (URL/Text)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} />
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => appendLecture({ lectureNumber: lectureFields.length + 1, title: "", type: "video", content: "", summary: "", duration: 15 })} className="mt-2">+ Add Lecture</Button>
    </Card>
  );
}

function TestForm({ testIndex, form, removeTest }: any) {
  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: `tests.${testIndex}.questions`,
  });

  return (
    <Card className="p-4 border-primary/20">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Test {testIndex + 1}</h3>
        <Button size="icon" variant="ghost" onClick={() => removeTest(testIndex)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <FormField control={form.control} name={`tests.${testIndex}.title`} render={({ field }) => <FormItem className="mb-2"><FormLabel>Test Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
      <FormField control={form.control} name={`tests.${testIndex}.durationMinutes`} render={({ field }) => <FormItem className="mb-4"><FormLabel>Duration (Minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>} />
      
      <div className="space-y-4">
        {questionFields.map((q, qIdx) => (
          <div key={q.id} className="p-4 bg-primary/5 rounded border">
            <div className="flex justify-between mb-2"><span className="font-semibold">Question {qIdx + 1}</span><Button variant="ghost" size="sm" onClick={() => removeQuestion(qIdx)}><Trash2 className="h-4 w-4"/></Button></div>
            <FormField control={form.control} name={`tests.${testIndex}.questions.${qIdx}.question`} render={({ field }) => <FormItem><FormControl><Input placeholder="Question text..." {...field} /></FormControl></FormItem>} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[0, 1, 2, 3].map(optIdx => (
                <FormField key={optIdx} control={form.control} name={`tests.${testIndex}.questions.${qIdx}.options.${optIdx}`} render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <FormControl><Input placeholder={`Option ${optIdx + 1}`} {...field} /></FormControl>
                    <FormField control={form.control} name={`tests.${testIndex}.questions.${qIdx}.correctAnswerIndex`} render={({ field: radioField }) => (
                      <input type="radio" checked={radioField.value === optIdx} onChange={() => radioField.onChange(optIdx)} />
                    )} />
                  </div>
                )} />
              ))}
            </div>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => appendQuestion({ question: "", options: ["", "", "", ""], correctAnswerIndex: 0 })}>+ Add Question</Button>
      </div>
    </Card>
  );
}
