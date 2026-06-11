
'use server';
/**
 * @fileOverview A world-class educational consultant and versatile mentor powered by Gemini.
 *
 * - aiCourseQATool - A function that provides deep educational and general insights.
 * - AICourseQAToolInput - The input type for the aiCourseQATool function.
 * - AICourseQAToolOutput - The return type for the aiCourseQATool function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const AICourseQAToolInputSchema = z.object({
  question: z
    .string()
    .describe("The student's question about course material or general growth."),
  courseMaterial: z
    .string()
    .optional()
    .describe("The relevant course material content to provide context."),
});
export type AICourseQAToolInput = z.infer<typeof AICourseQAToolInputSchema>;

const AICourseQAToolOutputSchema = z.object({
  answer: z
    .string()
    .describe("The AI's comprehensive and analytical answer."),
});
export type AICourseQAToolOutput = z.infer<typeof AICourseQAToolOutputSchema>;

/**
 * Server Action to handle AI Q&A.
 */
export async function aiCourseQATool(input: AICourseQAToolInput): Promise<AICourseQAToolOutput> {
  return aiCourseQAToolFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiCourseQAToolPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: {schema: AICourseQAToolInputSchema},
  output: {schema: AICourseQAToolOutputSchema},
  system: `You are a world-class mentor on the Scholars platform.
Your mission is to help students succeed in exams and growth.

Guidelines:
1. Provide deep, analytical answers with "Topper's Tips".
2. Be a helpful, wise mentor for general questions.
3. Maintain a professional, encouraging, and highly intelligent persona.`,
  prompt: `
{{#if courseMaterial}}
Context from the current lesson:
---
{{{courseMaterial}}}
---
{{/if}}

User's Query:
---
{{{question}}}
---

Please provide a comprehensive response that demonstrates broad thinking and deep insight.`,
});

const aiCourseQAToolFlow = ai.defineFlow(
  {
    name: 'aiCourseQAToolFlow',
    inputSchema: AICourseQAToolInputSchema,
    outputSchema: AICourseQAToolOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) throw new Error('AI failed to generate output');
    return output;
  }
);
