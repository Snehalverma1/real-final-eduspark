"use client";

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
import { PlusCircle, Trash2, Book, Film } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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
  chapters: z.array(chapterSchema).min(1, "At least one chapter is required."),
});

type CourseFormValues = z.infer<typeof courseSchema>;

export default function CreateCoursePage() {
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

  function onSubmit(data: CourseFormValues) {
    console.log(data);
    alert("Course created successfully! Check the console for the data.");
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
              onClick={() => appendChapter({ title: "", lectures: [] })}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter
            </Button>
          </div>

          <Button type="submit" size="lg" className="w-full">Create Course</Button>
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
                         <Textarea className="min-h-24" placeholder={form.watch(`chapters.${chapterIndex}.lectures.${lectureIndex}.type`) === 'video' ? "Enter video embed URL" : "Enter lesson text..."} {...field} />
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
