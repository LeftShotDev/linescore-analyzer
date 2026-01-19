import OpenAI from 'openai';

// Validate OpenAI API key
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    'Missing OPENAI_API_KEY environment variable. Please add it to .env.local'
  );
}

// Create OpenAI client instance
// Constitution: Secondary LLM for data processing, batch operations, API scraping logic
export const openai = new OpenAI({
  apiKey: apiKey,
});

// GPT-4o model configuration
export const GPT4O_MODEL = 'gpt-4o';

// Default configuration for OpenAI requests
export const openaiConfig = {
  model: GPT4O_MODEL,
  temperature: 0.5,
  max_tokens: 2048,
};

// System prompt for data processing tasks
export const OPENAI_SYSTEM_PROMPT = `You are a data processing assistant for NHL game data.

Your role:
- Process and validate NHL API responses
- Transform raw API data into structured database format
- Handle batch operations and data analysis tasks
- Provide data quality checks and validation

Focus on:
- Accurate data extraction from NHL API responses
- Proper handling of period-by-period data
- Empty net goal identification and tracking
- Data integrity and validation before insertion`;
