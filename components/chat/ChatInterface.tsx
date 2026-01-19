'use client';

import { useChat } from 'ai/react';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';

export function ChatInterface() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">NHL Linescore Period Analyzer</h1>
        <p className="text-sm text-gray-400 mt-1">
          Analyze period-by-period performance with natural language queries
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <MessageList messages={messages} error={error} />
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
