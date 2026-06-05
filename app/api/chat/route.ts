import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { CLAUDE_MODEL, CLAUDE_SYSTEM_PROMPT } from '@/lib/ai/claude-config';
import { queryLinescoreToolDefinition } from '@/lib/tools/query-linescore';
import { calculatePeriodStatsToolDefinition } from '@/lib/tools/calculate-period-stats';
import { addGamesToolDefinition } from '@/lib/tools/add-games';

export const maxDuration = 60;

type Message = { role: 'user' | 'assistant'; content: string };

const tools = {
  query_linescore_data: queryLinescoreToolDefinition,
  calculate_period_stats: calculatePeriodStatsToolDefinition,
  add_games_from_api: addGamesToolDefinition,
};

async function runChat(messages: Message[]): Promise<{ text: string; toolsUsed: string[] }> {
  const provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const result = await generateText({
    model: provider(CLAUDE_MODEL),
    system: CLAUDE_SYSTEM_PROMPT,
    messages,
    tools,
    maxSteps: 5,
  });

  const toolsUsed = (result.toolCalls ?? []).map((tc: { toolName: string }) => tc.toolName);

  return { text: result.text, toolsUsed };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, sessionId }: { messages: Message[]; sessionId?: string } = body;

    const session = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'No user message provided' }, { status: 400 });
    }

    if (['/clear', '/reset'].includes(lastMessage.content.trim().toLowerCase())) {
      return NextResponse.json({
        response: 'Conversation history cleared. How can I help you with NHL analytics?',
        sessionId: session,
        toolsUsed: [],
      });
    }

    let text: string;
    let toolsUsed: string[];

    try {
      ({ text, toolsUsed } = await runChat(messages));
    } catch (firstError) {
      // Auto-retry once with the error appended so Claude can adjust
      const errorMsg = firstError instanceof Error ? firstError.message : 'Unknown error';
      console.warn('[chat] First attempt failed, retrying:', errorMsg);

      try {
        const retryMessages: Message[] = [
          ...messages,
          { role: 'assistant', content: `I encountered an error: ${errorMsg}` },
          { role: 'user', content: 'Please try a different approach to answer my original question.' },
        ];
        ({ text, toolsUsed } = await runChat(retryMessages));
      } catch (retryError) {
        console.error('[chat] Retry also failed:', retryError);
        return NextResponse.json({
          response: "I'm having trouble processing your request right now. Could you try rephrasing your question?",
          sessionId: session,
          toolsUsed: [],
        });
      }
    }

    return NextResponse.json({ response: text, sessionId: session, toolsUsed });
  } catch (error) {
    console.error('[chat] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Use POST to send messages' }, { status: 405 });
}
