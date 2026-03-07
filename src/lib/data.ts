export type Lesson = {
  id: string;
  title: string;
  type: 'video' | 'text';
  content: string;
  duration: number; // in minutes
};

export type Course = {
  id: string;
  title: string;
  description: string;
  instructor: {
    name: string;
    avatarUrl: string;
  };
  thumbnailUrl: string;
  thumbnailHint: string;
  lessons: Lesson[];
};

export const courses: Course[] = [
  {
    id: 'nextjs-fundamentals',
    title: 'Next.js 14 Fundamentals',
    description: 'Learn the fundamentals of Next.js 14, including App Router, Server Components, and more.',
    instructor: {
      name: 'Jane Doe',
      avatarUrl: 'https://picsum.photos/seed/jane-doe/40/40',
    },
    thumbnailUrl: 'https://picsum.photos/seed/course1/600/400',
    thumbnailHint: 'programming abstract',
    lessons: [
      { id: '1', title: 'Introduction to Next.js', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 12 },
      { id: '2', title: 'File-based Routing', type: 'text', content: 'The App Router introduced in Next.js 13 provides a new way to structure your application. Instead of a `pages` directory, you use an `app` directory. Each folder inside `app` represents a route segment. A `page.tsx` file inside a folder makes that route publicly accessible.\n\nFor example, `app/dashboard/settings/page.tsx` would correspond to the `/dashboard/settings` route.\n\n**Layouts:**\nLayouts are special files (`layout.tsx`) that wrap a page or a segment of pages, sharing UI between them. This is perfect for headers, footers, and sidebars.', duration: 8 },
      { id: '3', title: 'Server Components vs. Client Components', type: 'text', content: 'Next.js 14 builds on React Server Components. By default, all components inside the `app` directory are Server Components. They run only on the server, which helps reduce the amount of JavaScript sent to the client, leading to faster initial page loads.\n\nTo make a component interactive and allow it to use hooks like `useState` or `useEffect`, you need to mark it as a Client Component by adding the `"use client";` directive at the top of the file. Despite the name, Client Components are still pre-rendered on the server for the initial load, providing a seamless user experience.', duration: 15 },
      { id: '4', title: 'Data Fetching', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 20 },
    ],
  },
  {
    id: 'ui-design-principles',
    title: 'UI Design Principles',
    description: 'Master the core principles of UI design to create beautiful and intuitive user interfaces.',
    instructor: {
      name: 'John Smith',
      avatarUrl: 'https://picsum.photos/seed/john-smith/40/40',
    },
    thumbnailUrl: 'https://picsum.photos/seed/course2/600/400',
    thumbnailHint: 'web design',
    lessons: [
      { id: '1', title: 'Visual Hierarchy', type: 'text', content: 'Visual hierarchy is one of the most important principles in UI design. It refers to the arrangement and presentation of elements in a way that implies importance. By using size, color, contrast, and placement, you can guide the user\'s eye to the most important parts of the interface first.\n\nKey techniques include:\n- **Size:** Larger elements attract more attention.\n- **Color & Contrast:** Bright colors or high-contrast elements stand out.\n- **Whitespace:** Using empty space around an element can make it more prominent.', duration: 10 },
      { id: '2', title: 'Color Theory', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 18 },
      { id: '3', title: 'Typography', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 15 },
    ],
  },
  {
    id: 'data-science-bootcamp',
    title: 'Data Science Bootcamp',
    description: 'A comprehensive introduction to data science, from Python basics to machine learning models.',
    instructor: {
      name: 'Ada Lovelace',
      avatarUrl: 'https://picsum.photos/seed/ada-lovelace/40/40',
    },
    thumbnailUrl: 'https://picsum.photos/seed/course3/600/400',
    thumbnailHint: 'data science',
    lessons: [
      { id: '1', title: 'Introduction to Python', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 25 },
      { id: '2', title: 'Pandas for Data Manipulation', type: 'text', content: 'Pandas is a powerful Python library for data analysis. The core data structures are the `Series` (a 1D array) and the `DataFrame` (a 2D table). \n\n**Creating a DataFrame:**\n```python\nimport pandas as pd\ndata = {\'Name\': [\'Tom\', \'Nick\', \'John\'], \'Age\': [20, 21, 19]}\ndf = pd.DataFrame(data)\nprint(df)\n```\nThis library is essential for cleaning, transforming, and analyzing data before feeding it into a machine learning model.', duration: 22 },
      { id: '3', title: 'Machine Learning Concepts', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 30 },
    ],
  },
  {
    id: 'digital-marketing-101',
    title: 'Digital Marketing 101',
    description: 'Learn the essentials of digital marketing, including SEO, content marketing, and social media strategy.',
    instructor: {
      name: 'Sam Alt',
      avatarUrl: 'https://picsum.photos/seed/sam-alt/40/40',
    },
    thumbnailUrl: 'https://picsum.photos/seed/course4/600/400',
    thumbnailHint: 'digital marketing',
    lessons: [
      { id: '1', title: 'Intro to SEO', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 14 },
      { id: '2', title: 'Content Marketing', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 16 },
      { id: '3', title: 'Social Media Strategy', type: 'text', content: 'A successful social media strategy involves more than just posting content. It requires a deep understanding of your target audience, clear goals, and consistent measurement.\n\n**The 5 Pillars of Social Media Strategy:**\n1. **Goals:** What do you want to achieve? (e.g., brand awareness, lead generation)\n2. **Audience:** Who are you trying to reach?\n3. **Content:** What will you share? (e.g., blog posts, videos, user-generated content)\n4. **Platforms:** Where does your audience spend their time? (e.g., Instagram, LinkedIn, TikTok)\n5. **Analysis:** How will you measure success? (e.g., engagement rate, click-through rate)', duration: 12 },
    ],
  },
    {
    id: 'creative-writing-masterclass',
    title: 'Creative Writing Masterclass',
    description: 'Unleash your inner storyteller and learn to write compelling narratives and characters.',
    instructor: {
      name: 'Mary Shelley',
      avatarUrl: 'https://picsum.photos/seed/mary-shelley/40/40',
    },
    thumbnailUrl: 'https://picsum.photos/seed/course5/600/400',
    thumbnailHint: 'creative writing',
    lessons: [
      { id: '1', title: 'Finding Your Voice', type: 'text', content: 'Every writer has a unique voice. It\'s the combination of your tone, style, and perspective. This lesson will help you discover and refine your authorial voice through writing exercises and reading analysis.', duration: 18 },
      { id: '2', title: 'Character Development', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 25 },
    ],
  },
    {
    id: 'photography-for-beginners',
    title: 'Photography for Beginners',
    description: 'Go from auto mode to manual mode. Learn the basics of composition, lighting, and camera settings.',
    instructor: {
      name: 'Ansel Adams',
      avatarUrl: 'https://picsum.photos/seed/ansel-adams/40/40',
    },
    thumbnailUrl: 'https://picsum.photos/seed/course6/600/400',
    thumbnailHint: 'photography basics',
    lessons: [
      { id: '1', title: 'The Exposure Triangle', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 20 },
      { id: '2', title: 'Composition Rules', type: 'text', content: 'Great photos are well-composed. Learn about classic composition rules like the Rule of Thirds, Leading Lines, and Framing to instantly improve your photos.', duration: 15 },
      { id: '3', title: 'Understanding Light', type: 'video', content: 'https://www.youtube.com/embed/Sklc_f_FWg4', duration: 22 },
    ],
  },
];
