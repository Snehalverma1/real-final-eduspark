import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Course } from "@/lib/data";
import { Button } from "./ui/button";
import { BookCopy } from "lucide-react";

type CourseCardProps = {
  course: Course;
};

export function CourseCard({ course }: CourseCardProps) {
  const totalLectures = course.chapters.reduce((acc, chapter) => acc + chapter.lectures.length, 0);

  return (
    <Link href={`/courses/${course.id}`} className="group block">
      <Card className="h-full flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <CardHeader className="p-0">
          <div className="relative h-48 w-full">
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              data-ai-hint={course.thumbnailHint}
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-grow">
          <CardTitle className="text-lg font-headline leading-tight mb-2 group-hover:text-primary transition-colors">
            {course.title}
          </CardTitle>
          <div className="flex items-center text-sm text-muted-foreground">
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={course.instructor.avatarUrl} alt={course.instructor.name} />
              <AvatarFallback>{course.instructor.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span>{course.instructor.name}</span>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex justify-between items-center">
            <div className="flex items-center text-sm text-muted-foreground">
                <BookCopy className="w-4 h-4 mr-1.5" />
                {totalLectures} lectures
            </div>
            <Button variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                View Course
            </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
