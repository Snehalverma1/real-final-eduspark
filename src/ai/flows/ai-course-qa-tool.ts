'use server';
/**
 * @fileOverview A professional AI educational consultant for exam preparation.
 *
 * - aiCourseQATool - A function that provides deep educational insights and answers.
 * - AICourseQAToolInput - The input type for the aiCourseQATool function.
 * - AICourseQAToolOutput - The return type for the aiCourseQATool function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AICourseQAToolInputSchema = z.object({
  question: z
    .string()
    .describe("The student's question about the course material or general exam topic."),
  courseMaterial: z
    .string()
    .optional()
    .describe(
      "The relevant course material content (text) to provide context, if available."
    ),
});
export type AICourseQAToolInput = z.infer<typeof AICourseQAToolInputSchema>;

const AICourseQAToolOutputSchema = z.object({
  answer: z
    .string()
    .describe(
      "The AI's comprehensive answer, integrating course context with professional educational knowledge."
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
  prompt: `You are a world-class educational consultant and expert teacher specializing in government competitive exams like SSC, Banking, Railways, and UPSC.

Your goal is to help students achieve "Rank 1" by providing deep, analytical, and highly professional answers.

{{#if courseMaterial}}
Here is the context from the current lesson:
---
{{{courseMaterial}}}
---
{{/if}}

Student's Question:
---
{{{question}}}
---

Instructions:
1. Use the provided course material as your primary source of truth if it contains the answer.
2. CRITICAL: If the question is broader than the material, or if the student needs a deeper explanation, use your extensive internal knowledge of the subject matter, pedagogy, and exam trends.
3. Don't just give a simple answer. Think broadly. Explain "the why" behind the concept.
4. Provide shortcuts, mnemonics, or "Topper's Tips" where applicable for exam prep.
5. Maintain a professional, encouraging, and highly intellectual tone.
6. If the student asks something completely unrelated to education or exams, politely guide them back to their learning path.`,
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
