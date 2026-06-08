"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { aiCourseQATool, type AICourseQAToolInput } from "@/ai/flows/ai-course-qa-tool";
import { Sparkles, Bot, BrainCircuit } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback } from "./ui/avatar";

type AIQaPanelProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  courseMaterial: string;
};

type FormState = {
  answer: string | null;
  error: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20">
      {pending ? (
        <>
          <BrainCircuit className="mr-2 h-4 w-4 animate-pulse" />
          Thinking Deeply...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Get Expert Insight
        </>
      )}
    </Button>
  );
}

export default function AiQaPanel({
  isOpen,
  setIsOpen,
  courseMaterial,
}: AIQaPanelProps) {
  const [formState, formAction] = useActionState(
    async (
      prevState: FormState,
      formData: FormData
    ): Promise<FormState> => {
      const question = formData.get("question") as string;
      if (!question) {
        return { answer: null, error: "Please enter a question." };
      }

      try {
        const input: AICourseQAToolInput = { question, courseMaterial };
        const result = await aiCourseQATool(input);
        return { answer: result.answer, error: null };
      } catch (e) {
        return {
          answer: null,
          error: "The AI consultant is currently busy. Please try again in a moment.",
        };
      }
    },
    { answer: null, error: null }
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col border-l-primary/10">
        <SheetHeader className="p-6 pb-4 bg-primary/5">
          <SheetTitle className="flex items-center gap-2 font-headline text-2xl">
            <div className="p-2 bg-primary rounded-lg">
                <BrainCircuit className="text-white w-5 h-5" />
            </div>
            Expert AI Consultant
          </SheetTitle>
          <SheetDescription className="text-foreground/70">
            Ask complex questions, request shortcuts, or get deep concept explanations from our advanced educational AI.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden px-6 pt-6">
            <ScrollArea className="h-full pr-4">
                {formState.answer && (
                    <Card className="mb-6 border-primary/20 bg-white shadow-xl rounded-2xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <Avatar className="w-10 h-10 border-2 border-primary shadow-sm">
                                    <AvatarFallback className="bg-primary text-primary-foreground">
                                        <Bot className="w-6 h-6"/>
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-3 flex-1">
                                    <p className="font-black text-primary text-sm uppercase tracking-widest">Expert Analysis</p>
                                    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                                        {formState.answer}
                                    </div>
                                    <div className="pt-4 border-t flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                        <Sparkles className="h-3 w-3" /> Powered by Gemini Advanced Thinking
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
                {formState.error && (
                    <Card className="mb-4 bg-destructive/5 border-destructive/20 rounded-xl">
                        <CardContent className="p-4 flex items-center gap-2 text-destructive text-sm font-medium">
                            <p>{formState.error}</p>
                        </CardContent>
                    </Card>
                )}
                {!formState.answer && !formState.error && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40 py-12">
                        <BrainCircuit className="h-16 w-16 mb-4" />
                        <p className="text-sm font-medium max-w-[200px]">Ask anything about your exam syllabus or lesson concepts.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
        <form action={formAction} className="p-6 border-t bg-card mt-auto">
            <div className="grid gap-4">
                <Textarea
                    name="question"
                    placeholder="e.g., Explain the visual shortcuts for solving quadratic equations in SSC exams..."
                    className="min-h-[120px] rounded-2xl border-primary/10 focus-visible:ring-primary shadow-inner"
                    required
                />
                <SubmitButton />
            </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
