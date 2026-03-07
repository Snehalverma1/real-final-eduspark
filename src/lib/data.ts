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
  instructor: {
    name: string;
    avatarUrl: string;
  };
  thumbnailUrl: string;
  thumbnailHint: string;
  targetClass: string;
  chapters: Chapter[];
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
    targetClass: '10',
    chapters: [
      {
        id: 'chap1',
        title: 'Introduction to Next.js',
        lectures: [
          { id: '1', title: 'Course Overview', type: 'video', content: 'https://player.vimeo.com/video/76979871', duration: 12 },
          { id: '2', title: 'File-based Routing', type: 'text', content: 'The App Router introduced in Next.js 13 provides a new way to structure your application. Instead of a `pages` directory, you use an `app` directory. Each folder inside `app` represents a route segment. A `page.tsx` file inside a folder makes that route publicly accessible.\n\nFor example, `app/dashboard/settings/page.tsx` would correspond to the `/dashboard/settings` route.\n\n**Layouts:**\nLayouts are special files (`layout.tsx`) that wrap a page or a segment of pages, sharing UI between them. This is perfect for headers, footers, and sidebars.', duration: 8 },
        ]
      },
      {
        id: 'chap2',
        title: 'Advanced Concepts',
        lectures: [
          { id: '3', title: 'Server Components vs. Client Components', type: 'text', content: 'Next.js 14 builds on React Server Components. By default, all components inside the `app` directory are Server Components. They run only on the server, which helps reduce the amount of JavaScript sent to the client, leading to faster initial page loads.\n\nTo make a component interactive and allow it to use hooks like `useState` or `useEffect`, you need to mark it as a Client Component by adding the `"use client";` directive at the top of the file. Despite the name, Client Components are still pre-rendered on the server for the initial load, providing a seamless user experience.', duration: 15 },
          { id: '4', title: 'Data Fetching', type: 'video', content: 'https://player.vimeo.com/video/76979871', duration: 20 },
        ]
      }
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
    targetClass: '9',
    chapters: [
      {
        id: 'chap1',
        title: 'Core Principles',
        lectures: [
          { id: '1', title: 'Visual Hierarchy', type: 'text', content: 'Visual hierarchy is one of the most important principles in UI design. It refers to the arrangement and presentation of elements in a way that implies importance. By using size, color, contrast, and placement, you can guide the user\'s eye to the most important parts of the interface first.\n\nKey techniques include:\n- **Size:** Larger elements attract more attention.\n- **Color & Contrast:** Bright colors or high-contrast elements stand out.\n- **Whitespace:** Using empty space around an element can make it more prominent.', duration: 10 },
          { id: '2', title: 'Color Theory', type: 'video', content: 'https://player.vimeo.com/video/76979871', duration: 18 },
          { id: '3', title: 'Typography', type: 'video', content: 'https://player.vimeo.com/video/76979871', duration: 15 },
        ]
      }
    ],
  },
];
