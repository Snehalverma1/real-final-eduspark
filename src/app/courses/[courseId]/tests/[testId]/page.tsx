
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Timer, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TakeTestPage() {
  const params = useParams<{ courseId: string; testId: string }>();
  const courseId = params?.courseId;
  const testId = params?.testId;
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const courseRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);

  const { data: course, isLoading: isCourseLoading } = useDoc(courseRef);

  const enrollmentRef = useMemoFirebase(() => {
    if (!firestore || !user || !courseId) return null;
    return doc(firestore, 'userProfiles', user.uid, 'enrollments', courseId);
  }, [firestore, user, courseId]);

  const test = useMemo(() => {
    return course?.tests?.find((t: any) => t.id === testId);
  }, [course, testId]);

  useEffect(() => {
    if (test && timeLeft === null) {
      setTimeLeft(test.durationMinutes * 60);
    }
  }, [test, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0) handleSubmit();
    if (timeLeft === null || timeLeft <= 0 || isFinished) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isFinished]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    if (!test || isFinished) return;
    setIsFinished(true);

    let correctCount = 0;
    test.questions.forEach((q: any) => {
      if (answers[q.id] === q.correctAnswerIndex) correctCount++;
    });

    const score = Math.round((correctCount / test.questions.length) * 100);

    if (enrollmentRef) {
      updateDocumentNonBlocking(enrollmentRef, {
        [`testResults.${testId}`]: score,
        updatedAt: serverTimestamp(),
      });
    }
  };

  if (isCourseLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!test) return <div className="p-8 text-center">Test not found.</div>;

  if (isFinished) {
    const correctCount = test.questions.filter((q: any) => answers[q.id] === q.correctAnswerIndex).length;
    const score = Math.round((correctCount / test.questions.length) * 100);

    return (
      <div className="container mx-auto p-4 md:p-8 max-w-2xl text-center">
        <Trophy className="h-20 w-20 text-accent mx-auto mb-6" />
        <h1 className="text-4xl font-bold font-headline mb-4">Exam Completed!</h1>
        <div className="bg-card p-8 rounded-3xl border shadow-xl mb-8">
            <p className="text-6xl font-black text-primary mb-2">{score}%</p>
            <p className="text-muted-foreground uppercase tracking-widest font-bold">Accuracy Score</p>
            <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="p-4 bg-muted/50 rounded-2xl">
                    <p className="text-2xl font-bold">{correctCount}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-2xl">
                    <p className="text-2xl font-bold">{test.questions.length - correctCount}</p>
                    <p className="text-xs text-muted-foreground">Incorrect</p>
                </div>
            </div>
        </div>
        <Button onClick={() => router.push(`/courses/${courseId}`)} size="lg" className="w-full h-14 rounded-2xl font-bold">Back to Curriculum</Button>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const progressValue = ((currentQuestionIndex + 1) / test.questions.length) * 100;

  return (
    <div className="min-h-screen bg-muted/30">
        <div className="bg-background border-b sticky top-0 z-50">
            <div className="container mx-auto p-4 flex justify-between items-center">
                <div>
                    <h1 className="font-bold text-lg">{test.title}</h1>
                    <p className="text-xs text-muted-foreground">SSC Sectional Mock Test</p>
                </div>
                <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold border", (timeLeft || 0) < 60 ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-primary/5 text-primary border-primary/10")}>
                    <Timer className="h-5 w-5" />
                    {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                </div>
            </div>
        </div>

        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <div className="mb-8 space-y-2">
                <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                    <span>Question {currentQuestionIndex + 1} of {test.questions.length}</span>
                    <span>{Math.round(progressValue)}% Complete</span>
                </div>
                <Progress value={progressValue} className="h-2" />
            </div>

            <Card className="rounded-3xl shadow-xl overflow-hidden border-none">
                <CardHeader className="p-8 bg-primary/5 border-b">
                    <CardTitle className="text-xl md:text-2xl leading-relaxed">{currentQuestion.question}</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    <RadioGroup value={answers[currentQuestion.id]?.toString()} onValueChange={(val) => handleAnswerSelect(currentQuestion.id, parseInt(val))} className="grid gap-4">
                        {currentQuestion.options.map((opt: string, idx: number) => (
                            <div key={idx} className={cn("flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer hover:bg-muted/50", answers[currentQuestion.id] === idx ? "border-primary bg-primary/5 shadow-inner" : "border-muted")}>
                                <RadioGroupItem value={idx.toString()} id={`opt-${idx}`} className="h-6 w-6 border-2" />
                                <Label htmlFor={`opt-${idx}`} className="flex-1 text-base md:text-lg cursor-pointer leading-tight py-2">{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
            </Card>

            <div className="flex justify-between items-center mt-8 gap-4">
                <Button variant="outline" size="lg" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)} className="rounded-2xl h-14 px-8">
                    <ChevronLeft className="mr-2 h-5 w-5" /> Previous
                </Button>
                
                {currentQuestionIndex === test.questions.length - 1 ? (
                    <Button onClick={handleSubmit} size="lg" className="rounded-2xl h-14 px-12 bg-green-600 hover:bg-green-700 font-bold shadow-xl shadow-green-500/20">
                        Submit Test <CheckCircle2 className="ml-2 h-5 w-5" />
                    </Button>
                ) : (
                    <Button size="lg" onClick={() => setCurrentQuestionIndex(prev => prev + 1)} className="rounded-2xl h-14 px-12 font-bold shadow-xl shadow-primary/20">
                        Next Question <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                )}
            </div>
        </div>
    </div>
  );
}
