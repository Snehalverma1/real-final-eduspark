"use client";

import { useFormState, useFormStatus } from "react-dom";
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
import { Sparkles, Bot } from "lucide-react";
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
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Thinking..." : "Get Answer"}
    </Button>
  );
}

export default function AiQaPanel({
  isOpen,
  setIsOpen,
  courseMaterial,
}: AIQaPanelProps) {
  const [formState, formAction] = useFormState(
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
          error: "An error occurred. Please try again.",
        };
      }
    },
    { answer: null, error: null }
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2 font-headline text-2xl">
            <Sparkles className="text-primary w-6 h-6" />
            AI-Powered Q&A
          </SheetTitle>
          <SheetDescription>
            Ask a question about the lesson content and get an instant answer from our AI assistant.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full">
                {formState.answer && (
                    <Card className="mb-4 bg-primary/5">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <Avatar className="w-8 h-8 border-2 border-primary/50">
                                    <AvatarFallback className="bg-primary text-primary-foreground">
                                        <Bot className="w-5 h-5"/>
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-primary">AI Assistant</p>
                                    <p className="text-sm">{formState.answer}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
                {formState.error && (
                    <p className="text-sm text-destructive mb-4">{formState.error}</p>
                )}
            </ScrollArea>
        </div>
        <form action={formAction} className="p-6 border-t bg-background">
            <div className="grid gap-4">
                <Textarea
                    name="question"
                    placeholder="e.g., What are React Server Components?"
                    className="min-h-[100px]"
                    required
                />
                <SubmitButton />
            </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
