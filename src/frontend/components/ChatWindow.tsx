import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../store';
import AnswerCard from './AnswerCard';
import ClinicalMarkdown from './ClinicalMarkdown';
import StreamingIndicator from './chat/StreamingIndicator';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * ChatWindow component - Clinical-style chat interface
 * Uses AnswerCard for message display with medical entity highlighting
 */
const ChatWindow: React.FC = () => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when message completes
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

    await submitQuery(query);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto p-4 min-h-[300px]"
        role="log"
        aria-label="对话历史"
        aria-live="polite"
      >
        {messages.length === 0 && !isGenerating ? (
          <div className="clinical-empty-state">
            <div className="clinical-empty-icon">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🩺
              </motion.div>
            </div>
            <p className="clinical-empty-title">开始诊断对话</p>
            <p className="clinical-empty-desc">
              输入医学问题，AI 将基于检索结果生成专业回答
            </p>
            <div className="clinical-empty-hints">
              <div className="clinical-empty-hint">• 支持药物对比查询</div>
              <div className="clinical-empty-hint">• 自动识别医学实体</div>
              <div className="clinical-empty-hint">• 提供证据来源追溯</div>
            </div>
          </div>
        ) : (
          <>
            {/* Historical messages */}
            {messages.map((message) => (
              <AnswerCard
                key={message.id}
                content={message.content}
                thinking={message.thinking}
                sources={message.results}
                timestamp={message.timestamp}
                isUser={message.role === 'user'}
              />
            ))}

            {/* Streaming state display */}
            {isGenerating && (
              <motion.div
                className="clinical-answer-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Header */}
                <div className="clinical-answer-header">
                  <div className="clinical-answer-title">
                    <StreamingIndicator phase={generationPhase} />
                  </div>
                  <motion.span
                    className="clinical-answer-badge success"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    实时生成
                  </motion.span>
                </div>

                {/* Thinking chain (real-time) */}
                {currentThinking && (
                  <div className="clinical-thinking-section">
                    <div className="clinical-thinking-content">
                      <pre className="clinical-thinking-text">{currentThinking}</pre>
                    </div>
                  </div>
                )}

                {/* Answer (real-time) */}
                {currentAnswer && (
                  <div className="clinical-answer-body">
                    <ClinicalMarkdown
                      content={currentAnswer}
                      streaming={true}
                    />
                  </div>
                )}

                {/* Sources (real-time) */}
                {currentSources.length > 0 && (
                  <div className="clinical-sources-section">
                    <div className="clinical-sources-toggle">
                      <span>已检索: {currentSources.length} 个片段</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          className="clinical-error-banner"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="clinical-error-icon">⚠️</span>
          <span>{error}</span>
        </motion.div>
      )}

      {/* Input area */}
      <div className="clinical-chat-input-area">
        <form onSubmit={handleSubmit} className="clinical-chat-form">
          <div className="clinical-chat-input-wrapper">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入医学问题，如：二甲双胍和利拉鲁肽哪个更适合肾功能不全患者？"
              aria-label="问题输入框"
              disabled={isLoading}
              className="clinical-chat-input"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="发送问题"
              className="clinical-chat-send-btn"
            >
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                发送
              </motion.span>
            </Button>
          </div>
          <div className="clinical-chat-input-meta">
            <span className="clinical-chat-hint">按 Enter 发送</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="clinical-chat-clear-btn"
            >
              清空历史
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;