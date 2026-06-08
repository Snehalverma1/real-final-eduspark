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
import { PlusCircle, Trash2, Book, Film, Loader2, ShieldAlert, Layers, Sparkles, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, collection, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { categories } from "@/lib/data";

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
  thumbnailUrl: z.string().optional().describe("URL for the course cover image."),
  difficultyLevel: z.enum(['Beginner', 'Intermediate', 'Advanced'], { required_error: "Please select a difficulty level." }),
  chapters: z.array(chapterSchema).min(1, "At least one chapter is required."),
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
      chapters: [{ title: "Chapter 1", lectures: [{ lectureNumber: 1, title: "", type: "video", content: "", summary: "", duration: 15 }] }],
    },
  });

  const { fields: chapterFields, append: appendChapter, remove: removeChapter } = useFieldArray({
    control: form.control,
    name: "chapters",
  });
  
  const { isSubmitting } = form.formState;
  const isBusy = isSubmitting || isSaving;
  const isLoading = isUserLoading || isProfileLoading;

  function onSubmit(data: CourseFormValues) {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to create a course.",
      });
      return;
    }
    
    setIsSaving(true);

    const courseId = doc(collection(firestore, 'courses')).id;
    const courseRef = doc(firestore, `courses`, courseId);

    const finalCourseData = {
      id: courseId,
      title: data.title,
      description: data.description,
      category: data.category,
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      instructorAvatarUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/40/40`,
      status: 'Published' as const,
      difficultyLevel: data.difficultyLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnailUrl: data.thumbnailUrl || `https://picsum.photos/seed/${courseId}/600/400`,
      chapters: data.chapters.map((chapter, cIndex) => ({
        id: `ch_${cIndex + 1}`,
        title: chapter.title,
        order: cIndex + 1,
        lectures: chapter.lectures.map((lecture, lIndex) => {
          const { duration, ...rest } = lecture;
          return {
            ...rest,
            id: `lec_${cIndex + 1}_${lIndex + 1}`,
            durationSeconds: duration * 60,
          };
        }),
      })),
    };

    setDoc(courseRef, finalCourseData)
      .then(() => {
        toast({
          title: "Course Published!",
          description: "Your new exam course is now live.",
        });
        router.push('/');
      })
      .catch((error: any) => {
        const permissionError = new FirestorePermissionError({
            path: courseRef.path,
            operation: 'create',
            requestResourceData: finalCourseData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
          setIsSaving(false);
      });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (userProfile?.role === 'student' || (userProfile?.role === 'teacher' && userProfile?.applicationStatus !== 'approved')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold font-headline">Access Denied</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Teacher approval is required to publish exam courses.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary/10 rounded-2xl">
          <Layers className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-headline">Create Exam Course</h1>
          <p className="text-muted-foreground">Fill in the details for your new government exam prep course.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-3xl border-primary/10 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Course Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Title (e.g., SSC CGL Quantitative Aptitude)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter title" className="rounded-xl h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brief Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What will students learn in this exam prep?"
                        className="min-h-32 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exam Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl h-12">
                              <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.filter(c => c !== "All").map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="difficultyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl h-12">
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Beginner">Beginner</SelectItem>
                            <SelectItem value="Intermediate">Intermediate</SelectItem>
                            <SelectItem value="Advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              <FormField
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Thumbnail Image URL
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" className="rounded-xl h-12" {...field} />
                    </FormControl>
                    <FormDescription>
                      Provide a URL for the course cover image. If left blank, a high-quality placeholder will be generated.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-2xl font-headline flex items-center gap-2">
              <Book className="h-6 w-6 text-primary" />
              Content Chapters
            </h2>
            {chapterFields.map((chapter, chapterIndex) => (
              <ChapterForm key={chapter.id} chapterIndex={chapterIndex} form={form} removeChapter={removeChapter} />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => appendChapter({ title: "", lectures: [{ lectureNumber: 1, title: "", type: "video", content: "", summary: "", duration: 15 }] })}
              className="w-full h-14 rounded-2xl border-dashed border-2 hover:bg-primary/5 border-primary/20"
            >
              <PlusCircle className="mr-2 h-5 w-5" /> Add Chapter
            </Button>
          </div>

          <Button type="submit" size="lg" className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20" disabled={isBusy}>
            {isBusy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Publish Exam Course
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
    <Card className="bg-card border-primary/5 rounded-3xl overflow-hidden shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5">
        <CardTitle className="text-lg">Chapter {chapterIndex + 1}</CardTitle>
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeChapter(chapterIndex)}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <FormField
          control={form.control}
          name={`chapters.${chapterIndex}.title`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chapter Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Number Systems" className="rounded-xl h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Lectures</h3>
            {lectureFields.map((lecture, lectureIndex) => (
              <div key={lecture.id} className="p-6 border rounded-2xl relative space-y-4 bg-muted/30">
                <div className="flex justify-between items-center">
                    <p className="font-bold text-primary">Lecture {lectureIndex + 1}</p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLecture(lectureIndex)}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <FormField
                            control={form.control}
                            name={`chapters.${chapterIndex}.lectures.${lectureIndex}.title`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl>
                                    <Input placeholder="Simplification Tips" className="rounded-xl" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                    control={form.control}
                    name={`chapters.${chapterIndex}.lectures.${lectureIndex}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="text">Text Lesson</SelectItem>
                            <SelectItem value="video">Video Lesson</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name={`chapters.${chapterIndex}.lectures.${lectureIndex}.content`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content (YouTube Link or Lesson Text)</FormLabel>
                      <FormControl>
                         <Textarea className="min-h-24 rounded-xl" placeholder="URL for videos, or full lesson text..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`chapters.${chapterIndex}.lectures.${lectureIndex}.summary`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        AI Study Notes & Summary
                      </FormLabel>
                      <FormDescription>
                        Crucial for videos! Provide key points or a transcription so the AI assistant can answer student questions accurately.
                      </FormDescription>
                      <FormControl>
                         <Textarea className="min-h-32 rounded-xl border-primary/20" placeholder="Provide a summary of the lesson content for the AI assistant..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
            <Button
                type="button"
                variant="ghost"
                onClick={() => appendLecture({ lectureNumber: lectureFields.length + 1, title: "", type: "video", content: "", summary: "", duration: 15 })}
                className="w-full text-primary hover:bg-primary/5 rounded-xl"
            >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Lecture to Chapter
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}