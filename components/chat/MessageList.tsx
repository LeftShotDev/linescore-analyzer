'use client';

import { Message } from 'ai/react';
import { useEffect, useRef } from 'react';
import { DataTable } from './DataTable';
import { StatsDisplay } from './StatsDisplay';
import { ImportSummary } from './ImportSummary';

interface MessageListProps {
  messages: Message[];
  error: Error | undefined;
  quickPrompts?: string[];
  onQuickPrompt?: (prompt: string) => void;
}

function determineDataType(results: any[]): 'team_period_performance' | 'period_win_rankings' | 'two_plus_reg_periods' | null {
  if (!results || results.length === 0) return null;

  const firstRow = results[0];

  // Check for team_period_performance (has period_number, goals_for, goals_against)
  if ('period_number' in firstRow && 'goals_for' in firstRow && 'period_outcome' in firstRow) {
    return 'team_period_performance';
  }

  // Check for period_win_rankings (has team_code, team_name, periods_won)
  if ('team_name' in firstRow && 'periods_won' in firstRow) {
    return 'period_win_rankings';
  }

  // Check for two_plus_reg_periods (has regulation_periods_won)
  if ('regulation_periods_won' in firstRow) {
    return 'two_plus_reg_periods';
  }

  return null;
}

export function MessageList({ messages, error, quickPrompts, onQuickPrompt }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  if (messages.length === 0 && !error) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-4">
            Hello! I can help you analyze NHL team statistics. Try asking about playoff probabilities, team comparisons, or schedule strength.
          </p>
          <p className="text-xs text-gray-500 mb-4">{currentTime}</p>
        </div>

        {quickPrompts && quickPrompts.length > 0 && (
          <div className="space-y-2">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onQuickPrompt?.(prompt)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
              <p className="text-xs text-red-600 mt-2">
                Try rephrasing your question or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          } mb-3`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0">
                {message.role === 'user' ? (
                  <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-medium">
                    U
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium">
                    AI
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {/* Tool invocations */}
                {message.toolInvocations && message.toolInvocations.length > 0 && (
                  <div className="mb-2 space-y-2">
                    {message.toolInvocations.map((tool, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50 border border-gray-200 rounded p-2 text-xs"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <svg
                            className="w-4 h-4 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="font-medium text-gray-700">
                            {tool.toolName === 'query_linescore_data'
                              ? 'Querying database'
                              : tool.toolName === 'add_games_from_api'
                              ? 'Fetching games from NHL API'
                              : tool.toolName === 'calculate_period_stats'
                              ? 'Calculating statistics'
                              : tool.toolName}
                          </span>
                          {tool.state === 'result' && (
                            <span className="text-green-600 text-xs">✓ Complete</span>
                          )}
                          {tool.state === 'call' && (
                            <span className="text-blue-600 text-xs">Running...</span>
                          )}
                        </div>
                        {tool.state === 'result' && tool.result && (
                          <div className="mt-2">
                            {typeof tool.result === 'object' && 'data' in tool.result && (
                              <>
                                <div className="text-xs text-gray-600 mb-2">
                                  {tool.result.data?.count
                                    ? `Found ${tool.result.data.count} results`
                                    : 'Query complete'}
                                  {tool.result.data?.query_metadata && (
                                    <span className="ml-2">
                                      ({tool.result.data.query_metadata.execution_time_ms}ms)
                                    </span>
                                  )}
                                </div>
                                {tool.result.data?.results && (() => {
                                  const dataType = determineDataType(tool.result.data.results);
                                  return dataType ? (
                                    <DataTable data={tool.result.data.results} type={dataType} />
                                  ) : null;
                                })()}
                                {tool.result.data?.stats && (
                                  <StatsDisplay
                                    stats={tool.result.data.stats}
                                    teamCode={tool.result.data.team_code}
                                  />
                                )}
                                {tool.toolName === 'add_games_from_api' &&
                                  tool.result.data?.games_processed !== undefined && (
                                    <ImportSummary data={tool.result.data} />
                                  )}
                              </>
                            )}
                            {typeof tool.result === 'object' && 'success' in tool.result && !tool.result.success && (
                              <div className="text-xs text-red-600 mt-1">
                                {tool.result.error?.message || 'Error occurred'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message content */}
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
