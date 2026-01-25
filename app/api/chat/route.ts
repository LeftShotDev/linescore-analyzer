import { NextRequest, NextResponse } from 'next/server';
import { processMessage, getConversationHistory, clearMemory } from '@/lib/langchain/agent';

// Allow responses up to 60 seconds for ReAct agent processing
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, sessionId } = body;

    // Get or generate a session ID for memory management
    const session = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get the latest user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'No user message provided' },
        { status: 400 }
      );
    }

    const userMessage = lastMessage.content;

    // Check for special commands
    if (userMessage.toLowerCase() === '/clear' || userMessage.toLowerCase() === '/reset') {
      clearMemory(session);
      return NextResponse.json({
        response: 'Conversation history cleared. How can I help you with NHL analytics?',
        sessionId: session,
      });
    }

    // Process the message with the LangChain ReAct agent
    const result = await processMessage(session, userMessage);

    // Return the response
    return NextResponse.json({
      response: result.response,
      sessionId: session,
      approvalRequired: result.approvalRequired,
      approvalId: result.approvalId,
      // Include intermediate steps in development mode
      ...(process.env.NODE_ENV === 'development' && {
        intermediateSteps: result.intermediateSteps,
      }),
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('ANTHROPIC_API_KEY')) {
        return NextResponse.json(
          {
            error: 'Configuration error',
            message: 'Anthropic API key is not configured.',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve conversation history
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const history = await getConversationHistory(sessionId);

    return NextResponse.json({
      sessionId,
      history,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
