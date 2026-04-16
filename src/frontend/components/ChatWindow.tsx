import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore, type RetrievalResult } from '../store';
import { useRetrievalStore, type ConfidenceLevel, type RetrievalStats } from '../store/retrievalStore';
import ThinkingChainDisplay from './ThinkingChainDisplay';
import { Brain, BookOpen, Loader2, ChevronRight, ChevronDown, Shield, ShieldAlert, ShieldCheck, Settings, Zap } from 'lucide-react';

/**
 * Confidence badge component
 */
const ConfidenceBadge: React.FC<{
  level: ConfidenceLevel;
  score: number;
}> = ({ level, score }) => {
  const colors = {
    high: 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300',
    medium: 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300',
    low: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300',
  };

  const icons = {
    high: ShieldCheck,
    medium: Shield,
    low: ShieldAlert,
  };

  const Icon = icons[level];

  return (
    <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${colors[level]}`}>
      <Icon className="w-3 h-3" />
      {(score * 100).toFixed(0)}%
    </span>
  );
};

/**
 * Retrieval stats panel component
 */
const RetrievalStatsPanel: React.FC<{
  stats: RetrievalStats | null;
  duration?: number;
}> = ({ stats, duration }) => {
  if (!stats) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 mb-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <span className="text-gray-500 dark:text-gray-400">
          粗排: {stats.coarseTopK}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          精排: {stats.refinedCount}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          平均置信度: {(stats.avgConfidence * 100).toFixed(0)}%
        </span>
        {duration && (
          <span className="text-gray-500 dark:text-gray-400">
            耗时: {duration}ms
          </span>
        )}
        <span className={`text-xs px-1 py-0.5 rounded ${
          stats.method === 'local-reranker'
            ? 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300'
            : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
        }`}>
          {stats.method === 'local-reranker' ? '本地模型' : '内部计算'}
        </span>
      </div>
    </div>
  );
};

/**
 * Source card component - displays individual retrieval result with confidence
 */
const SourceCard: React.FC<{
  result: RetrievalResult;
  index: number;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
}> = ({ result, index, confidenceScore, confidenceLevel }) => {
  const [expanded, setExpanded] = useState(false);

  const effectiveLevel = confidenceLevel || (
    result.similarityScore >= 0.7 ? 'high' :
    result.similarityScore >= 0.5 ? 'medium' : 'low'
  );
  const effectiveScore = confidenceScore || result.similarityScore;

  return (
    <div className="bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-500 p-2 mb-2">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300">
            #{index + 1}
          </span>
          {confidenceLevel && (
            <ConfidenceBadge level={effectiveLevel} score={effectiveScore} />
          )}
          {!confidenceLevel && (
            <span className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded">
              {(result.similarityScore * 100).toFixed(0)}% 相似
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-2 rounded">
          {result.parentChunkContent.slice(0, 500)}
          {result.parentChunkContent.length > 500 && '...'}
        </div>
      )}
    </div>
  );
};

/**
 * Streaming indicator - shows current generation phase
 */
const StreamingIndicator: React.FC<{
  phase: 'idle' | 'analysis' | 'retrieval' | 'reasoning' | 'answer' | 'complete' | 'error';
}> = ({ phase }) => {
  const phaseLabels = {
    idle: '',
    analysis: '分析问题...',
    retrieval: '检索资料...',
    reasoning: '正在思考...',
    answer: '生成回答...',
    complete: '完成',
    error: '出错',
  };

  if (phase === 'idle' || phase === 'complete') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-4"
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{phaseLabels[phase]}</span>
    </motion.div>
  );
};

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            智能问答
          </h2>
          <button
            onClick={clearHistory}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            清空历史
          </button>
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
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
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
                    <div className="bg-blue-600 text-white rounded-lg p-4">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                      {/* Thinking chain (if available) */}
                      {message.thinking && (
                        <div className="mb-3">
                          <button
                            onClick={() => setThinkingExpanded(!thinkingExpanded)}
                            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2"
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
                                <div className="bg-gray-50 dark:bg-gray-600 p-3 rounded text-sm text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                                  {message.thinking}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Answer content */}
                      <div className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {message.content}
                      </div>

                      {/* Sources */}
                      {message.results && message.results.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => setSourcesExpanded(!sourcesExpanded)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400"
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

                  <div className={`text-xs text-gray-500 mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming state display */}
            {isGenerating && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[85%] bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <StreamingIndicator phase={generationPhase} />

                  {/* Thinking chain (real-time) */}
                  {currentThinking && (
                    <div className="mb-3">
                      <button
                        onClick={() => setThinkingExpanded(!thinkingExpanded)}
                        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2"
                      >
                        <Brain className="w-4 h-4" />
                        <span>思考过程</span>
                        <span className="text-xs text-blue-500 font-medium">
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
                            <div className="bg-gray-50 dark:bg-gray-600 p-3 rounded text-sm text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap">
                              // Streaming cursor animation - smooth gradient effect
                      {currentThinking}
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="inline-block w-1.5 h-3 bg-blue-500 ml-1 rounded-sm"
                      />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Answer (real-time) */}
                  {(generationPhase === 'answer' || currentAnswer) && (
                    <div className="text-gray-900 dark:text-white whitespace-pre-wrap">
                      // Streaming cursor animation for answer
                      {currentAnswer}
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="inline-block w-1.5 h-3 bg-blue-500 ml-1 rounded-sm"
                      />
                    </div>
                  )}

                  {/* Sources (real-time) */}
                  {currentSources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
            placeholder="输入问题..."
            aria-label="问题输入框"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="发送问题"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            发送
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          按 Enter 发送，回答将实时流式显示
        </p>
      </form>
    </div>
  );
};

export default ChatWindow;