import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Course } from "@/lib/data";
import { Button } from "./ui/button";
import { BookCopy, Star, Clock } from "lucide-react";
import { Badge } from "./ui/badge";

type CourseCardProps = {
  course: Course;
};

export function CourseCard({ course }: CourseCardProps) {
  const totalLectures = course.chapters.reduce((acc, chapter) => acc + (chapter.lectures?.length || 0), 0);

  return (
    <Link href={`/courses/${course.id}`} className="group block">
      <Card className="h-full flex flex-col overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border-primary/5 group-hover:border-primary/20 rounded-2xl relative">
        <div className="absolute top-4 left-4 z-10">
          <Badge className="bg-white/90 backdrop-blur-md text-primary font-bold shadow-sm border-none">
            {course.category}
          </Badge>
        </div>
        <CardHeader className="p-0">
          <div className="relative h-56 w-full overflow-hidden">
            <Image
              src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/600/400`}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              data-ai-hint={course.thumbnailHint}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
        </CardHeader>
        <CardContent className="p-6 flex-grow">
          <div className="flex items-center gap-1 text-accent mb-3">
             {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
             ))}
             <span className="text-xs font-bold text-muted-foreground ml-1">4.9 (120+)</span>
          </div>
          <CardTitle className="text-xl font-headline leading-tight mb-4 group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]">
            {course.title}
          </CardTitle>
          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border-2 border-primary/10">
                <AvatarImage src={course.instructor.avatarUrl} alt={course.instructor.name} />
                <AvatarFallback>{course.instructor.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-semibold text-foreground/80">{course.instructor.name}</span>
            </div>
            <div className="flex items-center gap-1 font-medium">
               <Clock className="h-4 w-4" />
               <span>12h+ content</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-6 pb-6 pt-0 flex justify-between items-center">
            <div className="flex items-center text-sm font-bold text-primary">
                <BookCopy className="w-4 h-4 mr-1.5" />
                {totalLectures} Lessons
            </div>
            <Button variant="default" className="rounded-full shadow-lg shadow-primary/20">
                Enroll Now
            </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
