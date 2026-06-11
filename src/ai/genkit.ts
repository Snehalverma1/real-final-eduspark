
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit initialization. 
 * Note: We don't read the API key here at the module level because 
 * some serverless environments might not have process.env populated yet.
 * We pass the key explicitly in the flow if needed, or rely on the plugin 
 * picking it up from the environment at runtime.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: googleAI.model('gemini-2.5-flash'),
});
