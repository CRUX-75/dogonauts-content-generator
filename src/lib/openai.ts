import OpenAI from 'openai';
import { config } from '../config';

if (!config.openai.apiKey || !config.openai.apiKey.startsWith('sk-')) {
  throw new Error('Invalid or missing OPENAI_API_KEY');
}

export const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

console.log('[OPENAI] Client initialized successfully');