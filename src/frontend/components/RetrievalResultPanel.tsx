import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore, type RetrievalResult } from '../store';
import { BookOpen, ChevronDown, ChevronRight, FileText } from 'lucide-react';

/**
 * RetrievalResultPanel component
 * Displays retrieved chunks with similarity scores in Chat Tab sidebar
 */
const RetrievalResultPanel: React.FC = () => {
  const { currentSources, isGenerating, messages } = useChatStore();
  const [isExpanded, setIsExpanded] = useState(true);

  // Get last message sources if available
  const lastMessageSources = messages.length > 0
    ? messages[messages.length - 1].results
    : null;

  // Display either current streaming sources or last message sources
  const displaySources = currentSources.length > 0 ? currentSources : (lastMessageSources ?? []);

  // If no sources and not generating, show empty state
  if (displaySources.length === 0 && !isGenerating) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <BookOpen className="w-4 h-4" />
          <span className="text-sm">检索结果</span>
        </div>
        <div className="mt-4 text-center text-gray-400 dark:text-gray-500 text-sm">
          发送问题后查看检索结果
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            检索结果
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({displaySources.length}个片段)
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </motion.div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {displaySources.map((result, index) => (
                <motion.div
                  key={result.smallChunkId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      result.similarityScore >= 0.8
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                        : result.similarityScore >= 0.5
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                        : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                    }`}>
                      {(result.similarityScore * 100).toFixed(0)}% 相似
                    </span>
                  </div>

                  {/* Content preview */}
                  <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                    {result.parentChunkContent.slice(0, 200)}
                    {result.parentChunkContent.length > 200 && '...'}
                  </div>

                  {/* Expandable full content */}
                  <details className="mt-2">
                    <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                      查看完整内容
                    </summary>
                    <div className="mt-2 p-2 bg-white dark:bg-gray-600 rounded text-xs text-gray-600 dark:text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {result.parentChunkContent}
                    </div>
                  </details>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generating indicator */}
      {isGenerating && currentSources.length === 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <BookOpen className="w-4 h-4" />
            </motion.div>
            <span>检索中...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetrievalResultPanel;