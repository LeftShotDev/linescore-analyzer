import { streamText } from 'ai';
import { defaultProvider } from '@/lib/ai/providers';
import { CLAUDE_SYSTEM_PROMPT } from '@/lib/ai/claude-config';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Stream chat completion with Claude Sonnet 4.5
    const result = streamText({
      model: defaultProvider,
      system: CLAUDE_SYSTEM_PROMPT,
      messages,
      // Tools will be registered here in Phase 3+
      // tools: {
      //   query_linescore_data: ...,
      //   add_games_from_api: ...,
      //   calculate_period_stats: ...
      // },
      maxTokens: 4096,
      temperature: 0.7,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
