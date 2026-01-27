'use client';

import { useState, useCallback, useEffect } from 'react';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import type { ChatSize } from '../dashboard/Dashboard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

interface ChatInterfaceProps {
  chatSize?: ChatSize;
  onChatSizeChange?: (size: ChatSize) => void;
}

const quickPrompts = [
  'What teams have the most good wins this season?',
  'Show me period statistics for the Carolina Hurricanes',
  'Import games from October 8-15, 2024',
  'Compare Eastern vs Western conference teams',
  'Which teams win the most periods?',
];

export function ChatInterface({ chatSize = 'default', onChatSizeChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize session ID on mount
  useEffect(() => {
    const storedSessionId = sessionStorage.getItem('nhl_chat_session');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('nhl_chat_session', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get response');
      }

      const data = await response.json();

      // Update session ID if returned
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        sessionStorage.setItem('nhl_chat_session', data.sessionId);
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        toolsUsed: data.toolsUsed || [],
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));

      // Add error message to chat
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, sessionId]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    // Auto-submit after a brief delay to show the selected prompt
    setTimeout(() => {
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: prompt,
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
        }),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to get response');
          }
          return response.json();
        })
        .then(data => {
          if (data.sessionId && data.sessionId !== sessionId) {
            setSessionId(data.sessionId);
            sessionStorage.setItem('nhl_chat_session', data.sessionId);
          }

          const assistantMessage: Message = {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: data.response,
            toolsUsed: data.toolsUsed || [],
          };
          setMessages(prev => [...prev, assistantMessage]);
        })
        .catch(err => {
          console.error('Chat error:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
        })
        .finally(() => {
          setIsLoading(false);
          setInput('');
        });
    }, 100);
  }, [messages, sessionId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('nhl_chat_session', newSessionId);
    setSessionId(newSessionId);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#1c1c1c] border-b border-[#2e2e2e] px-5 py-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3ecf8e]/10 rounded-lg">
              <svg className="w-4 h-4 text-[#3ecf8e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-white">Analytics Agent</h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Resize buttons */}
            {onChatSizeChange && (
              <div className="flex items-center gap-1 mr-2">
                {/* Collapse/Default button */}
                <button
                  onClick={() => onChatSizeChange('default')}
                  className={`p-1.5 rounded transition-colors ${
                    chatSize === 'default'
                      ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]'
                      : 'text-[#888] hover:text-white hover:bg-[#2e2e2e]'
                  }`}
                  title="Default size"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                </button>
                {/* Expand button */}
                <button
                  onClick={() => onChatSizeChange('expanded')}
                  className={`p-1.5 rounded transition-colors ${
                    chatSize === 'expanded'
                      ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]'
                      : 'text-[#888] hover:text-white hover:bg-[#2e2e2e]'
                  }`}
                  title="Expand"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6m0 0v6m0-6l-7 7M9 21H3m0 0v-6m0 6l7-7" />
                  </svg>
                </button>
                {/* Maximize button */}
                <button
                  onClick={() => onChatSizeChange('maximized')}
                  className={`p-1.5 rounded transition-colors ${
                    chatSize === 'maximized'
                      ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]'
                      : 'text-[#888] hover:text-white hover:bg-[#2e2e2e]'
                  }`}
                  title="Maximize"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            )}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs text-[#888] hover:text-white px-2 py-1 rounded hover:bg-[#2e2e2e] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-[#888] ml-11">
          ReAct-powered with human-in-the-loop approval
        </p>
      </div>

      {/* Messages - scrollbar-gutter prevents layout shift when scrollbar appears */}
      <div className="flex-1 overflow-y-auto bg-[#171717]" style={{ scrollbarGutter: 'stable' }}>
        <MessageList
          messages={messages}
          error={error}
          quickPrompts={quickPrompts}
          onQuickPrompt={handleQuickPrompt}
          isLoading={isLoading}
        />
      </div>

      {/* Input */}
      <div className="bg-[#1c1c1c] border-t border-[#2e2e2e]">
        <InputBox
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
