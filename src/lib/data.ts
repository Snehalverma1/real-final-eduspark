export type Lecture = {
  id: string;
  title: string;
  type: 'video' | 'text';
  content: string;
  duration: number; // in minutes
};

export type Chapter = {
  id: string;
  title: string;
  lectures: Lecture[];
}

export type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  instructor: {
    name: string;
    avatarUrl: string;
  };
  thumbnailUrl: string;
  thumbnailHint: string;
  chapters: Chapter[];
};

export const categories = [
  "All",
  "SSC",
  "Banking",
  "Railway",
  "State PSC",
  "Defense",
  "UPSC"
];
