
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

/**
 * Server Action to handle AI Q&A.
 * Robustly checks for API keys and handles flow execution.
 */
export async function aiCourseQATool(
  input: AICourseQAToolInput
): Promise<AICourseQAToolOutput> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.error('[AI-CONFIG-ERROR] No Google API Key detected.');
    // We return a structured error response instead of throwing to prevent "Unexpected end of JSON input"
    return {
      answer: "I'm sorry, but my connection to the brain-center is missing. (Error: GOOGLE_GENAI_API_KEY is not set in the environment variables). Please contact the administrator.",
    };
  }

  try {
    return await aiCourseQAToolFlow(input);
  } catch (error: any) {
    console.error('[AI-FLOW-EXECUTION-ERROR]', error);
    return {
      answer: "I encountered an error while processing your request. This could be due to safety filters or a temporary connection issue. Please try rephrasing your question.",
    };
  }
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
    temperature: 0.7,
  },
  system: `You are a world-class mentor and expert teacher on the Scholars platform.
Your mission is to help students succeed in exams and growth.

Guidelines:
1. Academic Questions: Provide deep, analytical answers with "Topper's Tips".
2. General Questions: Be a helpful, wise mentor. Provide high-quality insights on life, strategy, and growth.
3. Use course material if provided, but broaden the conversation to encourage critical thinking.
4. Maintain a professional, encouraging, and highly intelligent persona.
5. If the user asks something non-academic, don't refuse it; answer it as a wise mentor.`,
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
    if (!output) {
      throw new Error('AI failed to generate output');
    }
    return output;
  }
);
