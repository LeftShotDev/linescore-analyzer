import { streamText } from 'ai';
import { defaultProvider } from '@/lib/ai/providers';
import { CLAUDE_SYSTEM_PROMPT } from '@/lib/ai/claude-config';
import { addGamesToolDefinition } from '@/lib/tools/add-games';
import { queryLinescoreToolDefinition } from '@/lib/tools/query-linescore';
import { calculatePeriodStatsToolDefinition } from '@/lib/tools/calculate-period-stats';

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
      tools: {
        // Phase 3: User Story 4 - Data Collection
        add_games_from_api: addGamesToolDefinition,
        // Phase 4: User Story 1 - Query
        query_linescore_data: queryLinescoreToolDefinition,
        // Phase 7: Enhanced Analytics
        calculate_period_stats: calculatePeriodStatsToolDefinition,
      },
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
