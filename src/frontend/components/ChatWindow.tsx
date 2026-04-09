import React, { useState, useRef, useEffect } from 'react';
import { useChatStore, type RetrievalResult } from '../store';

const ChatWindow: React.FC = () => {
  const { messages, isLoading, error, submitQuery, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput('');
    await submitQuery(query);
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400 py-8">
            Start a conversation by asking a question about your documents.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Retrieval results */}
                {message.results && message.results.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium mb-2">Sources:</div>
                    <div className="space-y-2">
                      {message.results.map((result, idx) => (
                        <ResultCard key={idx} result={result} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button
            type="button"
            onClick={clearHistory}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};

// Result card component
const ResultCard: React.FC<{ result: RetrievalResult }> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 p-2">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {(result.similarityScore * 100).toFixed(0)}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {result.sourceDocumentId.slice(0, 8)}...
          </span>
        </div>
        <span className="text-xs text-gray-400">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {result.parentChunkContent.slice(0, 500)}
          {result.parentChunkContent.length > 500 && '...'}
        </div>
      )}
    </div>
  );
};

export default ChatWindow;