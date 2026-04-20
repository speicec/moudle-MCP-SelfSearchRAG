import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../store';
import ThinkingChainDisplay from './ThinkingChainDisplay';
import { Brain, BookOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import StreamingIndicator from './chat/StreamingIndicator';
import SourceCard from './chat/SourceCard';

/**
 * ChatWindow component - uses WebSocket streaming state
 */
const ChatWindow: React.FC = () => {
  // Read streaming state from store
  const {
    messages,
    isLoading,
    error,
    isGenerating,
    generationPhase,
    currentThinking,
    currentAnswer,
    currentSources,
    submitQuery,
    clearHistory,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom only when message completes, not during streaming
  useEffect(() => {
    if (!isGenerating && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput('');
    setThinkingExpanded(false);
    setSourcesExpanded(false);

    // Submit triggers WebSocket events which update streaming state
    await submitQuery(query);
  };

  return (
    <div className="bg-card rounded-lg shadow h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            智能问答
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
          >
            清空历史
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto p-4 min-h-[300px] max-h-[700px]"
        role="log"
        aria-label="对话历史"
        aria-live="polite"
      >
        {messages.length === 0 && !isGenerating ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="mb-2">开始对话，询问关于文档的问题。</p>
            <p className="text-sm">上传文档后，可以基于检索结果生成智能回答。</p>
          </div>
        ) : (
          <>
            {/* Historical messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'user' && (
                    <div className="bg-primary text-primary-foreground rounded-lg p-4">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <div className="bg-muted rounded-lg p-4">
                      {/* Thinking chain (if available) */}
                      {message.thinking && (
                        <div className="mb-3">
                          <button
                            onClick={() => setThinkingExpanded(!thinkingExpanded)}
                            className="flex items-center gap-2 text-sm text-muted-foreground mb-2"
                          >
                            <Brain className="w-4 h-4" />
                            <span>思考过程</span>
                            <span className="text-xs">{thinkingExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                          </button>
                          <AnimatePresence>
                            {thinkingExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-background p-3 rounded text-sm text-muted-foreground font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                  {message.thinking}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Answer content */}
                      <div className="text-foreground whitespace-pre-wrap">
                        {message.content}
                      </div>

                      {/* Sources */}
                      {message.results && message.results.length > 0 && (
                        <div className="mt-4 pt-3 border-t">
                          <button
                            onClick={() => setSourcesExpanded(!sourcesExpanded)}
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>参考资料: {message.results.length}个片段</span>
                            <span className="text-xs">{sourcesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                          </button>

                          <AnimatePresence>
                            {sourcesExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-3 overflow-hidden"
                              >
                                {message.results.map((result, idx) => (
                                  <SourceCard key={idx} result={result} index={idx} />
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`text-xs text-muted-foreground mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming state display */}
            {isGenerating && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[85%] bg-muted rounded-lg p-4">
                  <StreamingIndicator phase={generationPhase} />

                  {/* Thinking chain (real-time) */}
                  {currentThinking && (
                    <div className="mb-3">
                      <button
                        onClick={() => setThinkingExpanded(!thinkingExpanded)}
                        className="flex items-center gap-2 text-sm text-muted-foreground mb-2"
                      >
                        <Brain className="w-4 h-4" />
                        <span>思考过程</span>
                        <span className="text-xs text-primary font-medium">
                          实时
                        </span>
                        <span className="text-xs">{thinkingExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                      </button>
                      <AnimatePresence>
                        {thinkingExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-background p-3 rounded text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                              {currentThinking}
                              <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                                className="inline-block w-1.5 h-3 bg-primary ml-1 rounded-sm"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Answer (real-time) */}
                  {(generationPhase === 'answer' || currentAnswer) && (
                    <div className="text-foreground whitespace-pre-wrap">
                      {currentAnswer}
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="inline-block w-1.5 h-3 bg-primary ml-1 rounded-sm"
                      />
                    </div>
                  )}

                  {/* Sources (real-time) */}
                  {currentSources.length > 0 && (
                    <div className="mt-3 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="w-4 h-4" />
                        <span>已检索: {currentSources.length}个片段</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题..."
            aria-label="问题输入框"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="发送问题"
          >
            发送
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          按 Enter 发送，回答将实时流式显示
        </p>
      </form>
    </div>
  );
};

export default ChatWindow;