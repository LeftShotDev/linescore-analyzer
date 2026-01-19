import { anthropic as anthropicSDK } from '@ai-sdk/anthropic';
import { openai as openaiSDK } from '@ai-sdk/openai';
import { CLAUDE_MODEL } from './claude-config';
import { GPT4O_MODEL } from './openai-config';

// Verify API keys are present
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

// Primary provider: Anthropic Claude Sonnet 4.5
// Used for user-facing chat, SQL generation, and tool calling
export const claude = anthropicSDK(CLAUDE_MODEL);

// Secondary provider: OpenAI GPT-4o
// Used for data processing, batch operations, and API scraping logic
export const gpt4o = openaiSDK(GPT4O_MODEL);

// Default provider for chat interface
export const defaultProvider = claude;

// Provider selector function for different use cases
export function getProvider(useCase: 'chat' | 'data-processing' = 'chat') {
  switch (useCase) {
    case 'chat':
      return claude;
    case 'data-processing':
      return gpt4o;
    default:
      return claude;
  }
}
