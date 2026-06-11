
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit. 
// Note: Genkit automatically looks for GOOGLE_GENAI_API_KEY in the environment.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: googleAI.model('gemini-2.5-flash'),
});
