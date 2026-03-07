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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, Book, Film, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, collection, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const lectureSchema = z.object({
  lectureNumber: z.coerce.number().min(1, "Lecture number is required."),
  title: z.string().min(3, "Lecture title must be at least 3 characters."),
  type: z.enum(["video", "text"], { required_error: "Please select a type."}),
  content: z.string().min(10, "Content is required."),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute."),
});

const chapterSchema = z.object({
  title: z.string().min(3, "Chapter title must be at least 3 characters."),
  lectures: z.array(lectureSchema).min(1, "At least one lecture is required per chapter."),
});

const courseSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(20, "Description must be at least 20 characters."),
  targetClass: z.string({ required_error: "Please select a target class."}),
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

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      chapters: [],
    },
  });

  const { fields: chapterFields, append: appendChapter, remove: removeChapter } = useFieldArray({
    control: form.control,
    name: "chapters",
  });
  
  const { isSubmitting } = form.formState;
  const isBusy = isSubmitting || isSaving;

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
      instructorId: user.uid,
      instructorName: user.displayName || 'Instructor',
      instructorAvatarUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/40/40`,
      status: 'Published' as const,
      targetClass: data.targetClass,
      difficultyLevel: data.difficultyLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnailUrl: `https://picsum.photos/seed/${courseId}/600/400`,
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
          description: "Your new course is now live and visible to students.",
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
          
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: "Could not publish the course. Please check your permissions and try again.",
        });
      })
      .finally(() => {
          setIsSaving(false);
      });
  }

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Optionally redirect or show a message
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center p-4">
        <h1 className="text-3xl font-bold font-headline">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          You must be logged in to create a course.
        </p>
        <Button onClick={() => router.push('/login')} className="mt-4">Login</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold font-headline mb-8">Create a New Course</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Advanced TypeScript" {...field} />
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
                    <FormLabel>Course Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your course in detail..."
                        className="min-h-32"
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
                    name="targetClass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Class</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[...Array(12)].map((_, i) => (
                              <SelectItem key={i + 1} value={`${i + 1}`}>{`Class ${i + 1}`}</SelectItem>
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
                            <SelectTrigger>
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
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-2xl font-headline">Chapters</h2>
            {chapterFields.map((chapter, chapterIndex) => (
              <ChapterForm key={chapter.id} chapterIndex={chapterIndex} form={form} removeChapter={removeChapter} />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => appendChapter({ title: "", lectures: [{ lectureNumber: 1, title: "", type: "text", content: "", duration: 5 }] })}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter
            </Button>
             <FormMessage>{form.formState.errors.chapters?.message}</FormMessage>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isBusy}>
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish Course
          </Button>
        </form>
      </Form>
    </div>
  );
}


type ChapterFormProps = {
  chapterIndex: number;
  form: any;
  removeChapter: (index: number) => void;
};

function ChapterForm({ chapterIndex, form, removeChapter }: ChapterFormProps) {
  const { fields: lectureFields, append: appendLecture, remove: removeLecture } = useFieldArray({
    control: form.control,
    name: `chapters.${chapterIndex}.lectures`,
  });

  return (
    <Card className="bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Chapter {chapterIndex + 1}</CardTitle>
        <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => removeChapter(chapterIndex)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name={`chapters.${chapterIndex}.title`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chapter Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Introduction to..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <div className="space-y-4">
            <h3 className="font-semibold">Lectures</h3>
            {lectureFields.map((lecture, lectureIndex) => (
              <div key={lecture.id} className="p-4 border rounded-lg relative space-y-4 bg-background">
                <div className="flex justify-between items-center">
                    <p className="font-semibold">Lecture {lectureIndex + 1}</p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLecture(lectureIndex)}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
                 <FormField
                    control={form.control}
                    name={`chapters.${chapterIndex}.lectures.${lectureIndex}.lectureNumber`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lecture Number</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={form.control}
                  name={`chapters.${chapterIndex}.lectures.${lectureIndex}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lecture Title</FormLabel>
                      <FormControl>
                        <Input placeholder="What are server components?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`chapters.${chapterIndex}.lectures.${lectureIndex}.type`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lecture Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select lesson type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="text"><Book className="inline-block mr-2 h-4 w-4"/>Text</SelectItem>
                          <SelectItem value="video"><Film className="inline-block mr-2 h-4 w-4"/>Video</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`chapters.${chapterIndex}.lectures.${lectureIndex}.content`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                         <Textarea className="min-h-24" placeholder={form.watch(`chapters.${chapterIndex}.lectures.${lectureIndex}.type`) === 'video' ? "Enter video URL from Vimeo or YouTube" : "Enter lesson text..."} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name={`chapters.${chapterIndex}.lectures.${lectureIndex}.duration`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
            <FormMessage>{form.formState.errors.chapters?.[chapterIndex]?.lectures?.message}</FormMessage>
            <Button
            type="button"
            variant="outline"
            onClick={() => appendLecture({ lectureNumber: lectureFields.length + 1, title: "", type: "text", content: "", duration: 5 })}
            className="w-full"
            >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Lecture
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
