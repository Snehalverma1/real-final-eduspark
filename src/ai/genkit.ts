import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Use the plugin's model factory for a more stable reference
  model: googleAI.model('gemini-2.5-flash'),
});
