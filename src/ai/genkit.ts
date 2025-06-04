import {genkit} from 'genkit';
import {openAI} from 'genkitx-openai'; // Updated import

export const ai = genkit({
  plugins: [openAI()], // The openAI() plugin will use the OPENAI_API_KEY environment variable
  model: 'openai/gpt-3.5-turbo', // Using a common OpenAI model
});
