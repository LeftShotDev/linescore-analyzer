'use client';

import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

interface MessageListProps {
  messages: Message[];
  error: Error | null;
  quickPrompts?: string[];
  onQuickPrompt?: (prompt: string) => void;
  isLoading?: boolean;
}

// Human-readable tool names
const toolDisplayNames: Record<string, { name: string; icon: string; color: string }> = {
  query_period_data: {
    name: 'Query Database',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  fetch_nhl_games: {
    name: 'NHL API',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  calculate_team_stats: {
    name: 'Calculate Stats',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    color: 'bg-[#3ecf8e]/20 text-[#3ecf8e] border-[#3ecf8e]/30',
  },
  request_human_approval: {
    name: 'Approval Request',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
};

export function MessageList({ messages, error, quickPrompts, onQuickPrompt, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  if (messages.length === 0 && !error && !isLoading) {
    return (
      <div className="flex flex-col h-full p-5">
        <div className="mb-5">
          <p className="text-sm text-[#ccc] mb-3">
            Hello! I'm your NHL Analytics Agent powered by the ReAct pattern. I can help you:
          </p>
          <ul className="text-sm text-[#888] list-disc list-inside mb-3 space-y-1.5">
            <li>Query period-by-period game data</li>
            <li>Import games from the NHL API</li>
            <li>Calculate team statistics and rankings</li>
            <li>Analyze "good wins" vs "bad wins" patterns</li>
          </ul>
          <p className="text-xs text-[#666]">{currentTime}</p>
        </div>

        {quickPrompts && quickPrompts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[#888] font-medium mb-2">Try asking:</p>
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onQuickPrompt?.(prompt)}
                className="w-full text-left px-3 py-2.5 text-sm text-[#ccc] bg-[#232323] border border-[#2e2e2e] rounded-lg hover:bg-[#2a2a2a] hover:border-[#3ecf8e]/50 hover:text-white transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Helper to format message content with markdown-like styling
  const formatContent = (content: string) => {
    // Handle code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        return (
          <pre key={idx} className="bg-[#171717] rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-[#ccc] border border-[#2e2e2e]">
            {code}
          </pre>
        );
      }

      // Handle inline formatting
      return (
        <span key={idx} className="whitespace-pre-wrap">
          {part.split(/(\*\*[^*]+\*\*)/g).map((segment, sIdx) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              return <strong key={sIdx} className="text-white">{segment.slice(2, -2)}</strong>;
            }
            return segment;
          })}
        </span>
      );
    });
  };

  // Render tool badges for a message
  const renderToolBadges = (toolsUsed?: string[]) => {
    if (!toolsUsed || toolsUsed.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#2e2e2e]">
        <span className="text-[10px] text-[#666] uppercase tracking-wide">Tools used:</span>
        {toolsUsed.map((toolId, idx) => {
          const tool = toolDisplayNames[toolId] || {
            name: toolId.replace(/_/g, ' '),
            icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
            color: 'bg-[#333] text-[#888] border-[#444]',
          };

          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tool.color}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} />
              </svg>
              {tool.name}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-5 space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
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
              <h3 className="text-sm font-medium text-red-400">Error</h3>
              <p className="text-sm text-red-300 mt-1">{error.message}</p>
              <p className="text-xs text-red-400/70 mt-2">
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
            className={`max-w-[90%] rounded-lg px-3 py-2.5 text-sm ${
              message.role === 'user'
                ? 'bg-[#3ecf8e] text-[#171717]'
                : 'bg-[#232323] border border-[#2e2e2e] text-[#ccc]'
            }`}
          >
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 mt-0.5">
                {message.role === 'user' ? (
                  <div className="w-5 h-5 rounded-full bg-[#2ba56e] flex items-center justify-center text-[10px] font-medium text-white">
                    U
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#3ecf8e] to-[#2ba56e] flex items-center justify-center text-[9px] font-bold text-[#171717]">
                    AI
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="break-words">
                  {formatContent(message.content)}
                </div>
                {message.role === 'assistant' && renderToolBadges(message.toolsUsed)}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-start mb-3">
          <div className="max-w-[90%] rounded-lg px-3 py-2.5 text-sm bg-[#232323] border border-[#2e2e2e]">
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#3ecf8e] to-[#2ba56e] flex items-center justify-center text-[9px] font-bold text-[#171717]">
                  AI
                </div>
              </div>
              <div className="flex items-center space-x-2 text-[#888]">
                <svg className="w-4 h-4 animate-spin text-[#3ecf8e]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Thinking and reasoning...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
