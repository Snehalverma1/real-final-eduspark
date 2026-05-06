
# EduSpark - Ignite Your Learning Journey

EduSpark is a modern, AI-powered educational platform designed for seamless learning and interactive teaching.

## 🚀 Features

- **Live Teaching Rooms**: Real-time peer-to-peer video classrooms using WebRTC and Firebase signaling. Includes screen sharing and picture-in-picture face camera.
- **Course Management**: Complete system for teachers to create, publish, and manage multi-chapter courses.
- **AI Q&A Assistant**: Intelligent bot powered by Genkit to answer student questions based on lesson material.
- **Admin Dashboard**: Moderation system for teacher applications and platform oversight.
- **Role-based Access**: Specialized views for students, teachers, and administrators.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Backend/Auth**: [Firebase](https://firebase.google.com/)
- **Database**: [Cloud Firestore](https://firebase.google.com/docs/firestore)
- **AI**: [Genkit](https://firebase.google.com/docs/genkit)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)

## 🏁 Getting Started

### 1. Prerequisites
- Node.js 18+
- A Firebase Project

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory and add your Firebase configuration details:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GOOGLE_GENAI_API_KEY=your_genkit_api_key
```

### 4. Development
```bash
npm run dev
```
Open [http://localhost:9002](http://localhost:9002) in your browser.

## 📦 How to push to GitHub

1. Create a new repository on [GitHub](https://github.com/new).
2. Open your terminal in this project's root folder.
3. Run the following commands:

```bash
git init
git add .
git commit -m "Initial commit: EduSpark prototype"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 📦 Deployment
This project is configured for [Firebase App Hosting](https://firebase.google.com/docs/app-hosting).
