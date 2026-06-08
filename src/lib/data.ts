export type Lecture = {
  id: string;
  title: string;
  type: 'video' | 'text';
  content: string; // URL for video, full text for text lesson
  summary?: string; // Summary or transcription for AI context
  duration: number; // in minutes
  lectureNumber?: number;
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
  targetClass?: string;
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
