// LangChain ReAct Agent for NHL Period Analyzer
// Implements the ReAct (Reasoning + Acting) pattern with memory management

import { ChatAnthropic } from '@langchain/anthropic';
import { createAgent } from 'langchain';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Import tools
import { queryPeriodDataTool } from './tools/query-period-data';
import { fetchNhlGamesTool } from './tools/fetch-nhl-games';
import { calculateTeamStatsTool } from './tools/calculate-team-stats';
import {
  requestHumanApprovalTool,
  findApprovalInMessage,
  isRejectionMessage,
  approveOperation,
  rejectOperation,
  getPendingApprovals,
} from './tools/request-human-approval';

// System prompt specific to the NHL Period Analyzer application
const SYSTEM_PROMPT = `You are an expert NHL analytics assistant specializing in period-by-period game analysis. Your primary goal is to help users understand team performance through the lens of period outcomes.

## Core Hypothesis
Teams that win 2 or more individual periods in regulation (not including OT/SO) are more likely to:
1. Win games consistently
2. Succeed in playoffs (where they face the same opponent 4-7 times)

## Key Metrics You Track
- **Good Wins**: Games won where the team also won 2+ regulation periods
- **Bad Wins**: Games won WITHOUT winning 2+ regulation periods
- **Difference**: Good Wins minus Bad Wins (higher is better for playoff success)
- **Period Outcomes**: WIN, LOSS, or TIE for each period (excluding empty net goals from 3rd period calculations)

## Your Capabilities
1. **Query Period Data**: Search and analyze period-by-period results from the database
2. **Fetch NHL Games**: Import new game data from the official NHL API
3. **Calculate Team Statistics**: Aggregate period data into meaningful team metrics
4. **Request Human Approval**: Get user confirmation for large operations (7+ days of data)

## Guidelines
- Always explain your reasoning before using tools
- When analyzing data, highlight patterns related to the core hypothesis
- For bulk imports (>7 days), ALWAYS use request_human_approval first
- Present statistics in a clear, organized manner
- Compare teams using the good wins/bad wins framework

## Data Notes
- Game IDs follow format: YYYYTTGGGG (e.g., 2024020003)
  - YYYY = season start year
  - TT = 02 (regular season) or 03 (playoffs)
  - GGGG = game number
- The 2024-2025 season has 1312 regular season games
- Empty net goals are tracked separately and excluded from 3rd period outcome calculations

Remember: You're helping users discover insights about which teams are genuinely dominant (winning periods) vs teams that may be winning games through luck or special circumstances.`;

// Define the tools array
const tools = [
  queryPeriodDataTool,
  fetchNhlGamesTool,
  calculateTeamStatsTool,
  requestHumanApprovalTool,
];

// Store for conversation memories (keyed by session ID)
// Format: { messages: Array<{role: string, content: string}> }
const memoryStore = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

/**
 * Get conversation history for a session
 */
function getHistory(sessionId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, []);
  }
  return memoryStore.get(sessionId)!;
}

/**
 * Add message to conversation history
 */
function addToHistory(sessionId: string, role: 'user' | 'assistant', content: string): void {
  const history = getHistory(sessionId);
  history.push({ role, content });
  // Keep last 20 messages to prevent context overflow
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

/**
 * Clear memory for a session
 */
export function clearMemory(sessionId: string): void {
  memoryStore.delete(sessionId);
}

/**
 * Create and run the NHL ReAct agent
 */
async function runAgent(sessionId: string, userMessage: string): Promise<string> {
  // Initialize the Anthropic model
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.7,
  });

  // Get conversation history
  const history = getHistory(sessionId);

  // Build context with history
  const historyContext = history.length > 0
    ? `\n\nPrevious conversation:\n${history.map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`).join('\n')}\n\n`
    : '';

  // Create the ReAct agent
  const agent = createAgent({
    model,
    tools,
    systemPrompt: `${SYSTEM_PROMPT}${historyContext}`,
  });

  // Run the agent
  const result = await agent.invoke({
    messages: [{ role: 'human' as const, content: userMessage }],
  });

  // Extract the final response
  const messages = result.messages || [];
  const lastMessage = messages[messages.length - 1];

  let response = '';
  if (lastMessage) {
    if (typeof lastMessage.content === 'string') {
      response = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      // Handle structured content
      response = lastMessage.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }
  }

  return response || 'I apologize, but I was unable to generate a response. Please try again.';
}

/**
 * Process a user message with the ReAct agent
 */
export async function processMessage(
  sessionId: string,
  userMessage: string
): Promise<{
  response: string;
  intermediateSteps?: any[];
  approvalRequired?: boolean;
  approvalId?: string;
}> {
  // Check if this is an approval/rejection response
  const pendingApprovals = getPendingApprovals();
  if (pendingApprovals.length > 0) {
    const approvalId = findApprovalInMessage(userMessage);
    const isRejection = isRejectionMessage(userMessage);

    if (approvalId && !isRejection) {
      approveOperation(approvalId);
      // Add to history
      addToHistory(sessionId, 'user', userMessage);
      const response = `Operation approved. I'll now proceed with the import. This may take a moment...`;
      addToHistory(sessionId, 'assistant', response);
      return {
        response,
        approvalRequired: false,
      };
    }

    if (isRejection && pendingApprovals.length > 0) {
      // Reject the most recent pending approval
      const mostRecent = pendingApprovals[pendingApprovals.length - 1];
      rejectOperation(mostRecent.id);
      // Add to history
      addToHistory(sessionId, 'user', userMessage);
      const response = `Operation cancelled. The ${mostRecent.operationType} has been rejected. Is there anything else I can help you with?`;
      addToHistory(sessionId, 'assistant', response);
      return {
        response,
        approvalRequired: false,
      };
    }
  }

  try {
    // Add user message to history
    addToHistory(sessionId, 'user', userMessage);

    // Run the agent
    const response = await runAgent(sessionId, userMessage);

    // Add response to history
    addToHistory(sessionId, 'assistant', response);

    // Check if approval is required (look for approval_id in response)
    const approvalMatch = response.match(/approval_\d+_[a-z0-9]+/i);
    const approvalRequired = approvalMatch !== null;

    return {
      response,
      approvalRequired,
      approvalId: approvalMatch?.[0],
    };
  } catch (error) {
    console.error('Agent error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return {
          response: 'I\'m currently experiencing high demand. Please wait a moment and try again.',
        };
      }
      if (error.message.includes('timeout')) {
        return {
          response: 'The request took too long to process. Please try a more specific query.',
        };
      }
    }

    return {
      response: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your question.`,
    };
  }
}

/**
 * Get conversation history for a session (public API)
 */
export async function getConversationHistory(sessionId: string): Promise<Array<{
  role: 'user' | 'assistant';
  content: string;
}>> {
  return getHistory(sessionId);
}
