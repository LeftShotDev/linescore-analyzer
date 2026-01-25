'use client';

import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  error: Error | null;
  quickPrompts?: string[];
  onQuickPrompt?: (prompt: string) => void;
  isLoading?: boolean;
}

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
      <div className="flex flex-col h-full p-4">
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-2">
            Hello! I'm your NHL Analytics Agent powered by the ReAct pattern. I can help you:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside mb-3 space-y-1">
            <li>Query period-by-period game data</li>
            <li>Import games from the NHL API</li>
            <li>Calculate team statistics and rankings</li>
            <li>Analyze "good wins" vs "bad wins" patterns</li>
          </ul>
          <p className="text-xs text-gray-500">{currentTime}</p>
        </div>

        {quickPrompts && quickPrompts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium mb-2">Try asking:</p>
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onQuickPrompt?.(prompt)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
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
          <pre key={idx} className="bg-gray-100 rounded p-2 my-2 overflow-x-auto text-xs font-mono">
            {code}
          </pre>
        );
      }

      // Handle inline formatting
      return (
        <span key={idx} className="whitespace-pre-wrap">
          {part.split(/(\*\*[^*]+\*\*)/g).map((segment, sIdx) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              return <strong key={sIdx}>{segment.slice(2, -2)}</strong>;
            }
            return segment;
          })}
        </span>
      );
    });
  };

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
            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 mt-0.5">
                {message.role === 'user' ? (
                  <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-medium">
                    U
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white">
                    AI
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="break-words">
                  {formatContent(message.content)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-start mb-3">
          <div className="max-w-[90%] rounded-lg px-3 py-2 text-sm bg-white border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white">
                  AI
                </div>
              </div>
              <div className="flex items-center space-x-2 text-gray-500">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
