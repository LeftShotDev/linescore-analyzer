'use client';

import { useChat } from 'ai/react';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';

const quickPrompts = [
  'Which teams have the highest playoff probability?',
  'Show me teams with Stanley Cup odds above 5%',
  'Compare the top 5 teams by points',
  'What are the strongest schedules remaining?',
  'Analyze Western Conference playoff race',
];

export function ChatInterface() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setInput,
    append,
  } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  const handleQuickPrompt = (prompt: string) => {
    append({
      role: 'user',
      content: prompt,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">NHL Analytics Assistant</h2>
        </div>
        <p className="text-sm text-gray-600">Ask questions about team statistics and predictions.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <MessageList messages={messages} error={error} quickPrompts={quickPrompts} onQuickPrompt={handleQuickPrompt} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200">
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
