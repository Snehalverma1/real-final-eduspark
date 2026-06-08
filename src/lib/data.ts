
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

export type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
};

export type Test = {
  id: string;
  title: string;
  durationMinutes: number;
  questions: Question[];
};

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
  tests?: Test[];
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
