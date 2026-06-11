
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
    .describe("The student's question, which could be about course material, exam strategy, or general knowledge."),
  courseMaterial: z
    .string()
    .optional()
    .describe("The relevant course material content (text) to provide context, if available."),
});
export type AICourseQAToolInput = z.infer<typeof AICourseQAToolInputSchema>;

const AICourseQAToolOutputSchema = z.object({
  answer: z
    .string()
    .describe("The AI's comprehensive, analytical, and broad-thinking answer."),
});
export type AICourseQAToolOutput = z.infer<typeof AICourseQAToolOutputSchema>;

export async function aiCourseQATool(
  input: AICourseQAToolInput
): Promise<AICourseQAToolOutput> {
  // Check for API key presence to provide immediate feedback
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
    throw new Error('AI Configuration Error: Missing GOOGLE_GENAI_API_KEY. Please add it to your hosting Environment Variables.');
  }
  
  return aiCourseQAToolFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiCourseQAToolPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: {schema: AICourseQAToolInputSchema},
  output: {schema: AICourseQAToolOutputSchema},
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
    temperature: 0.8,
  },
  system: `You are a world-class mentor and expert teacher on the Scholars platform.
Your primary mission is to help students succeed in exams and life.
You have vast knowledge across all academic subjects, history, science, technology, and philosophy.

Guidelines:
1. If a question is academic, provide deep, analytical answers with "Topper's Tips".
2. If a question is general or non-academic, be a helpful, wise mentor. Do not refuse to answer general questions; instead, provide high-quality insights that help the user grow.
3. Use the provided course material if it's relevant, but don't be limited by it. Broaden the conversation whenever possible to encourage critical thinking.
4. Maintain a professional, encouraging, and highly intelligent persona.`,
  prompt: `
{{#if courseMaterial}}
Context from the current lesson (use this if relevant):
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
