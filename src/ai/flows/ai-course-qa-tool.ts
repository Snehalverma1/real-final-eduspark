'use server';
/**
 * @fileOverview An AI-powered Q&A tool for course materials.
 *
 * - aiCourseQATool - A function that provides answers to student questions based on course material.
 * - AICourseQAToolInput - The input type for the aiCourseQATool function.
 * - AICourseQAToolOutput - The return type for the aiCourseQATool function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AICourseQAToolInputSchema = z.object({
  question: z
    .string()
    .describe("The student's question about the course material."),
  courseMaterial: z
    .string()
    .describe(
      "The relevant course material content (text) to answer the question from."
    ),
});
export type AICourseQAToolInput = z.infer<typeof AICourseQAToolInputSchema>;

const AICourseQAToolOutputSchema = z.object({
  answer: z
    .string()
    .describe(
      "The AI's answer to the question, based on the provided course material."
    ),
});
export type AICourseQAToolOutput = z.infer<typeof AICourseQAToolOutputSchema>;

export async function aiCourseQATool(
  input: AICourseQAToolInput
): Promise<AICourseQAToolOutput> {
  return aiCourseQAToolFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiCourseQAToolPrompt',
  input: {schema: AICourseQAToolInputSchema},
  output: {schema: AICourseQAToolOutputSchema},
  prompt: `You are an intelligent AI assistant specialized in providing clear and concise answers to student questions based *only* on the provided course material.

Here is the course material:
---
{{{courseMaterial}}}
---

Here is the student's question:
---
{{{question}}}
---

Based solely on the provided course material, answer the student's question.
If the answer cannot be found within the provided material, respond with "I'm sorry, but I cannot find an answer to your question in the provided course material."
Do not use outside knowledge.`,
});

const aiCourseQAToolFlow = ai.defineFlow(
  {
    name: 'aiCourseQAToolFlow',
    inputSchema: AICourseQAToolInputSchema,
    outputSchema: AICourseQAToolOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
