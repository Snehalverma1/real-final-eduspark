
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit initialization with explicit API key handling.
 * It checks both GOOGLE_GENAI_API_KEY and GOOGLE_API_KEY to ensure
 * compatibility with different environment setups.
 */
const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

export const ai = genkit({
  plugins: [
    // Explicitly pass the API key to the plugin to ensure it's picked up
    // across different serverless/hosting environments.
    googleAI({ apiKey }),
  ],
  model: googleAI.model('gemini-2.5-flash'),
});
