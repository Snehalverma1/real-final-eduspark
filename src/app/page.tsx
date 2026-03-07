import { CourseCard } from "@/components/course-card";
import { Input } from "@/components/ui/input";
import { courses } from "@/lib/data";
import { Search } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <section className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tighter text-primary">
          Ignite Your Learning Journey
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
          Explore a universe of knowledge with courses on everything from Next.js to creative writing. Find your spark.
        </p>
        <div className="mt-8 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input placeholder="Search for courses..." className="pl-10 h-12 text-base" />
        </div>
      </section>

      <section>
        <h2 className="text-2xl md:text-3xl font-bold font-headline mb-8">Popular Courses</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>
    </div>
  );
}
