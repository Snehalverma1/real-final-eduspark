
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit initialization. 
 * We use the standard plugins but avoid specifying a default model 
 * at the top level to prevent early initialization crashes if the 
 * environment variables are not yet fully populated in some serverless contexts.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
