// LangChain ReAct Agent for NHL Period Analyzer
// Implements the ReAct (Reasoning + Acting) pattern with memory management

import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

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

// New tools
import { syncRecentGamesTool } from './tools/sync-recent-games';
import { lookupTeamTool } from './tools/lookup-team';
import { compareTeamsTool } from './tools/compare-teams';
import { getStandingsTool } from './tools/get-standings';
import { checkDataHealthTool } from './tools/check-data-health';
import { getTeamScheduleTool } from './tools/get-team-schedule';
import { analyzeTrendsTool } from './tools/analyze-trends';

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
5. **Sync Recent Games**: Automatically sync games from the last N days (simpler than manual date ranges)
6. **Lookup Team**: Resolve team names/nicknames to official codes (e.g., "Canes" → "CAR")
7. **Compare Teams**: Head-to-head analysis with period-level insights
8. **Get Standings**: Fetch current NHL standings from the official API
9. **Check Data Health**: Diagnose database issues (missing data, gaps, etc.)
10. **Get Team Schedule**: View a team's recent/upcoming games with results
11. **Analyze Trends**: Track team performance changes over time

## Guidelines
- Always explain your reasoning before using tools
- When analyzing data, highlight patterns related to the core hypothesis
- For bulk imports (>7 days), ALWAYS use request_human_approval first
- Present statistics in a clear, organized manner
- Compare teams using the good wins/bad wins framework

## Tool Selection Guide
- User mentions a team by nickname/city → Use **lookup_team** first
- "Keep data up to date" or "sync games" → Use **sync_recent_games**
- "Compare X vs Y" or "head to head" → Use **compare_teams**
- "Current standings" or "playoff picture" → Use **get_standings**
- "Show me [team]'s last/recent games" → Use **get_team_schedule**
- "Is [team] improving?" or "trends" → Use **analyze_trends**
- "Why is data missing?" or "check database" → Use **check_data_health**

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
  // Core tools
  queryPeriodDataTool,
  fetchNhlGamesTool,
  calculateTeamStatsTool,
  requestHumanApprovalTool,
  // New tools
  syncRecentGamesTool,
  lookupTeamTool,
  compareTeamsTool,
  getStandingsTool,
  checkDataHealthTool,
  getTeamScheduleTool,
  analyzeTrendsTool,
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
async function runAgent(sessionId: string, userMessage: string): Promise<{ response: string; toolsUsed: string[] }> {
  // Initialize the Anthropic model
  const model = new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.7,
  });

  // Get conversation history
  const history = getHistory(sessionId);

  // Build messages array with history
  const messages: (HumanMessage | AIMessage)[] = [];

  // Add conversation history
  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else {
      messages.push(new AIMessage(msg.content));
    }
  }

  // Add the current user message
  messages.push(new HumanMessage(userMessage));

  // Create the ReAct agent with LangGraph
  const agent = createReactAgent({
    llm: model,
    tools,
  });

  // Run the agent
  const result = await agent.invoke({
    messages: [
      new SystemMessage(SYSTEM_PROMPT),
      ...messages,
    ],
  });

  // Extract tools used from the agent's messages
  const toolsUsed: string[] = [];
  const agentMessages = result.messages || [];

  for (const msg of agentMessages) {
    // Check for AI messages with tool calls
    if (msg._getType?.() === 'ai' || msg.constructor?.name === 'AIMessage') {
      const toolCalls = (msg as any).tool_calls || (msg as any).additional_kwargs?.tool_calls;
      if (toolCalls && Array.isArray(toolCalls)) {
        for (const toolCall of toolCalls) {
          const toolName = toolCall.name || toolCall.function?.name;
          if (toolName && !toolsUsed.includes(toolName)) {
            toolsUsed.push(toolName);
            console.log(`[Agent] Tool called: ${toolName}`);
          }
        }
      }
    }

    // Also check for ToolMessage to capture tool names
    if (msg._getType?.() === 'tool' || msg.constructor?.name === 'ToolMessage') {
      const toolName = (msg as any).name;
      if (toolName && !toolsUsed.includes(toolName)) {
        toolsUsed.push(toolName);
        console.log(`[Agent] Tool result from: ${toolName}`);
      }
    }
  }

  // Extract the final response from the agent's messages
  let response = '';

  // Find the last AI message with text content
  for (let i = agentMessages.length - 1; i >= 0; i--) {
    const msg = agentMessages[i];
    if (msg._getType?.() === 'ai' || msg.constructor?.name === 'AIMessage') {
      if (typeof msg.content === 'string' && msg.content.trim()) {
        response = msg.content;
        break;
      } else if (Array.isArray(msg.content)) {
        // Handle structured content
        const textContent = msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        if (textContent.trim()) {
          response = textContent;
          break;
        }
      }
    }
  }

  // If no response found, check for tool messages that might contain the result
  if (!response) {
    for (let i = agentMessages.length - 1; i >= 0; i--) {
      const msg = agentMessages[i];
      if (msg._getType?.() === 'tool' || msg.constructor?.name === 'ToolMessage') {
        // The agent may have returned a tool result without a final message
        response = 'I processed your request. The operation completed successfully.';
        break;
      }
    }
  }

  return {
    response: response || 'I apologize, but I was unable to generate a response. Please try again.',
    toolsUsed,
  };
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
  toolsUsed?: string[];
}> {
  // Check if this is an approval/rejection response
  const pendingApprovalsList = getPendingApprovals();
  if (pendingApprovalsList.length > 0) {
    const approvalId = findApprovalInMessage(userMessage);
    const isRejection = isRejectionMessage(userMessage);

    if (approvalId && !isRejection) {
      // Get approval details before approving
      const approvalDetails = pendingApprovalsList.find(a => a.id === approvalId);
      approveOperation(approvalId);

      // Add user approval to history
      addToHistory(sessionId, 'user', userMessage);

      // Now run the agent with a message that the approval was granted
      // This allows the agent to continue with the actual operation
      const continueMessage = `The user approved the operation (${approvalDetails?.description || 'bulk import'}). Please proceed with the import now.`;

      try {
        const { response, toolsUsed } = await runAgent(sessionId, continueMessage);
        addToHistory(sessionId, 'assistant', response);
        return {
          response,
          approvalRequired: false,
          toolsUsed: ['request_human_approval', ...toolsUsed],
        };
      } catch (error) {
        console.error('Error continuing after approval:', error);
        const errorResponse = 'Operation approved, but I encountered an error while processing. Please try the request again.';
        addToHistory(sessionId, 'assistant', errorResponse);
        return {
          response: errorResponse,
          approvalRequired: false,
          toolsUsed: ['request_human_approval'],
        };
      }
    }

    if (isRejection && pendingApprovalsList.length > 0) {
      // Reject the most recent pending approval
      const mostRecent = pendingApprovalsList[pendingApprovalsList.length - 1];
      rejectOperation(mostRecent.id);
      // Add to history
      addToHistory(sessionId, 'user', userMessage);
      const response = `Operation cancelled. The ${mostRecent.operationType} has been rejected. Is there anything else I can help you with?`;
      addToHistory(sessionId, 'assistant', response);
      return {
        response,
        approvalRequired: false,
        toolsUsed: ['request_human_approval'],
      };
    }
  }

  try {
    // Add user message to history
    addToHistory(sessionId, 'user', userMessage);

    // Run the agent
    const { response, toolsUsed } = await runAgent(sessionId, userMessage);

    // Add response to history
    addToHistory(sessionId, 'assistant', response);

    // Check if approval is required (look for approval_id in response)
    const approvalMatch = response.match(/approval_\d+_[a-z0-9]+/i);
    const approvalRequired = approvalMatch !== null;

    return {
      response,
      approvalRequired,
      approvalId: approvalMatch?.[0],
      toolsUsed,
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
