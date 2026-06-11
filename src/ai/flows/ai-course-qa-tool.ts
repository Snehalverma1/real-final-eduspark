'use server';
/**
 * @fileOverview A world-class educational consultant powered by Gemini.
 *
 * - aiCourseQATool - A function that provides deep educational insights.
 * - AICourseQAToolInput - The input type for the aiCourseQATool function.
 * - AICourseQAToolOutput - The return type for the aiCourseQATool function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const AICourseQAToolInputSchema = z.object({
  question: z
    .string()
    .describe("The student's question about the course material or general exam topic."),
  courseMaterial: z
    .string()
    .optional()
    .describe("The relevant course material content (text) to provide context, if available."),
});
export type AICourseQAToolInput = z.infer<typeof AICourseQAToolInputSchema>;

const AICourseQAToolOutputSchema = z.object({
  answer: z
    .string()
    .describe("The AI's comprehensive and analytical answer."),
});
export type AICourseQAToolOutput = z.infer<typeof AICourseQAToolOutputSchema>;

export async function aiCourseQATool(
  input: AICourseQAToolInput
): Promise<AICourseQAToolOutput> {
  return aiCourseQAToolFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiCourseQAToolPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: {schema: AICourseQAToolInputSchema},
  output: {schema: AICourseQAToolOutputSchema},
  config: {
    // Relaxed safety settings to allow for "broad thinking" on potentially sensitive academic topics
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
    temperature: 0.7, // Balance between accuracy and creative broad thinking
  },
  system: `You are a world-class educational consultant and expert teacher.
Your goal is to help students achieve top ranks in competitive exams.
You have broad, deep knowledge of pedagogy, exam trends, and all academic subjects.
While you use the provided lesson material as context, you are encouraged to expand on concepts, provide shortcuts, and share "Topper's Tips" from your internal knowledge base.`,
  prompt: `
{{#if courseMaterial}}
Context from current lesson:
---
{{{courseMaterial}}}
---
{{/if}}

Student's Question:
---
{{{question}}}
---

Please provide a deep, analytical answer that encourages broad thinking and provides actionable exam strategies.`,
});

const aiCourseQAToolFlow = ai.defineFlow(
  {
    name: 'aiCourseQAToolFlow',
    inputSchema: AICourseQAToolInputSchema,
    outputSchema: AICourseQAToolOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        throw new Error('AI failed to generate a structured response.');
      }
      return output;
    } catch (error: any) {
      console.error('Genkit Flow Error:', error);
      throw error;
    }
  }
);
