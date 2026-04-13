import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Phase status type
 */
type PhaseStatus = 'pending' | 'running' | 'completed';

/**
 * Phase data
 */
interface PhaseData {
  id: 'analysis' | 'retrieval' | 'reasoning';
  label: string;
  status: PhaseStatus;
  content?: string;
  sourcesCount?: number;
}

/**
 Thinking chain display props
 */
interface ThinkingChainDisplayProps {
  query: string;
  phases: PhaseData[];
  thinkingContent: string;
  sourcesCount: number;
  isStreaming: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/**
 * Phase status indicator
 */
const PhaseIndicator: React.FC<{ status: PhaseStatus }> = ({ status }) => {
  if (status === 'completed') {
    return (
      <span className="text-green-500 text-lg">
        ✓
      </span>
    );
  }

  if (status === 'running') {
    return (
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="text-blue-500 text-lg"
      >
        ○
      </motion.span>
    );
  }

  return (
    <span className="text-gray-400 text-lg">
      ○
    </span>
  );
};

/**
 * Thinking chain display component
 * Shows three-phase visualization: analysis → retrieval → synthesis
 */
const ThinkingChainDisplay: React.FC<ThinkingChainDisplayProps> = ({
  query,
  phases,
  thinkingContent,
  sourcesCount,
  isStreaming,
  isExpanded,
  onToggleExpand,
}) => {
  // Default phases if not provided
  const defaultPhases: PhaseData[] = phases.length > 0 ? phases : [
    { id: 'analysis', label: '分析问题', status: query ? 'completed' : 'pending' },
    { id: 'retrieval', label: '检索资料', status: sourcesCount > 0 ? 'completed' : 'pending', sourcesCount },
    { id: 'reasoning', label: '正在思考', status: thinkingContent ? 'running' : 'pending' },
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            思考链
          </span>
          {isStreaming && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-xs text-blue-500"
            >
              进行中...
            </motion.span>
          )}
        </div>
        <button
          onClick={onToggleExpand}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {isExpanded ? '收起 ▼' : '展开 ▶'}
        </button>
      </div>

      {/* Phase status indicators */}
      <div className="flex items-center gap-4 mb-2">
        {defaultPhases.map((phase, index) => (
          <div key={phase.id} className="flex items-center gap-2">
            <PhaseIndicator status={phase.status} />
            <span className={`text-sm ${
              phase.status === 'completed' ? 'text-green-600 dark:text-green-400' :
              phase.status === 'running' ? 'text-blue-600 dark:text-blue-400' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              {phase.label}
            </span>
            {phase.id === 'retrieval' && phase.sourcesCount !== undefined && phase.sourcesCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({phase.sourcesCount}个片段)
              </span>
            )}
            {index < defaultPhases.length - 1 && (
              <span className="text-gray-400 mx-1">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Expanded thinking content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 overflow-hidden"
          >
            {/* Query display */}
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                用户问题
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded p-2">
                {query || '等待输入...'}
              </div>
            </div>

            {/* Sources preview */}
            {sourcesCount > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  📚 参考资料: {sourcesCount}个片段
                </div>
              </div>
            )}

            {/* Thinking content */}
            {thinkingContent && (
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  思考过程
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 rounded p-2 font-mono whitespace-pre-wrap max-h-200 overflow-y-auto">
                  {thinkingContent}
                  {isStreaming && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="inline-block w-2 h-4 bg-blue-500 ml-1"
                    />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact thinking chain indicator for inline use
 */
export const ThinkingChainIndicator: React.FC<{
  isGenerating: boolean;
  phase?: 'analysis' | 'retrieval' | 'reasoning' | 'answer';
}> = ({ isGenerating, phase }) => {
  if (!isGenerating) return null;

  const phaseLabels = {
    analysis: '分析问题',
    retrieval: '检索资料',
    reasoning: '正在思考',
    answer: '生成回答',
  };

  return (
    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="inline-block"
      >
        ⏳
      </motion.span>
      <span>{phaseLabels[phase || 'analysis']}</span>
    </div>
  );
};

export default ThinkingChainDisplay;