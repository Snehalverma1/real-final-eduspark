
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit initialization. 
 * By default, this looks for GOOGLE_GENAI_API_KEY in your environment.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
