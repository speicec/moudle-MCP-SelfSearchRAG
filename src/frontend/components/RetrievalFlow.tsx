import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRetrievalStore, useChatStore } from '../store';
import { Check, Loader2, ArrowDown, ArrowRight } from 'lucide-react';
import Skeleton from './ui/Skeleton';

/**
 * Step card component for retrieval flow visualization
 */
const StepCard: React.FC<{
  title: string;
  status: 'pending' | 'active' | 'completed';
  children?: React.ReactNode;
}> = ({ title, status, children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 rounded-lg border-2 ${
        status === 'active'
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : status === 'completed'
          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          status === 'active'
            ? 'bg-blue-500 text-white'
            : status === 'completed'
            ? 'bg-green-500 text-white'
            : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
        }`}>
          {status === 'completed' && (
            <Check className="w-4 h-4" />
          )}
          {status === 'active' && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
        </div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
};

/**
 * Query embedding visualization
 */
const QueryEmbedding: React.FC<{
  query: string;
  isActive: boolean;
  progress: number;
}> = ({ query, isActive, progress }) => {
  return (
    <div className="space-y-3">
      {/* Original query */}
      <div className="p-2 rounded bg-gray-100 dark:bg-gray-800 text-sm">
        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">查询文本</span>
        <span className="text-gray-900 dark:text-white">{query}</span>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <motion.div
          animate={isActive ? { y: [0, 5, 0] } : {}}
          transition={{ duration: 0.5, repeat: isActive ? Infinity : 0 }}
        >
          <ArrowDown className="w-6 h-6 text-gray-400" />
        </motion.div>
      </div>

      {/* Embedding process */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700`}>
          <motion.div
            className="h-full rounded-full bg-blue-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{progress}%</span>
      </div>

      {/* Vector representation */}
      {progress === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2 rounded bg-blue-100 dark:bg-blue-900/50 text-sm"
        >
          <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">向量 (768维)</span>
          <span className="font-mono text-xs text-blue-900 dark:text-blue-100">
            [0.23, -0.45, 0.12, ...]
          </span>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Similarity search visualization
 */
const SimilaritySearch: React.FC<{
  matches: Array<{ smallChunkId: string; similarityScore: number; rank: number }>;
  isActive: boolean;
}> = ({ matches, isActive }) => {
  return (
    <div className="space-y-3">
      {/* Vector space abstraction */}
      <div className="relative h-32 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {/* Query vector */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full bg-blue-500 -translate-x-1/2 -translate-y-1/2"
        />

        {/* Match points */}
        {matches.map((match, index) => {
          // Randomize positions for visualization
          const angle = (index / matches.length) * Math.PI * 2;
          const distance = 30 + Math.random() * 20;
          const x = 50 + Math.cos(angle) * distance;
          const y = 50 + Math.sin(angle) * distance;

          return (
            <motion.div
              key={match.smallChunkId}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 ${
                match.similarityScore >= 0.8 ? 'bg-green-500' : match.similarityScore >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            >
              {/* Connection line */}
              <svg className="absolute top-1/2 left-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 opacity-30">
                <line
                  x1="50%"
                  y1="50%"
                  x2="50%"
                  y2="0"
                  stroke="currentColor"
                  strokeWidth="1"
                  className={match.similarityScore >= 0.8 ? 'text-green-500' : match.similarityScore >= 0.5 ? 'text-yellow-500' : 'text-red-500'}
                />
              </svg>
            </motion.div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-1 right-1 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-500">≥80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-gray-500">≥50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-500">&lt;50%</span>
          </div>
        </div>
      </div>

      {/* Match list */}
      {matches.length > 0 && (
        <div className="space-y-1">
          {matches.slice(0, 3).map((match) => (
            <div key={match.smallChunkId} className="flex items-center justify-between text-sm p-1 rounded bg-gray-100 dark:bg-gray-800">
              <span className="font-mono text-xs text-gray-500">{match.smallChunkId.slice(0, 8)}...</span>
              <span className={`text-xs ${match.similarityScore >= 0.8 ? 'text-green-600' : match.similarityScore >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                {(match.similarityScore * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Parent expansion visualization
 */
const ParentExpansion: React.FC<{
  results: Array<{ smallChunkId: string; parentChunkId: string; similarityScore: number }>;
  isActive: boolean;
}> = ({ results, isActive }) => {
  const uniqueParents = new Map<string, Array<{ smallChunkId: string; similarityScore: number }>>();

  results.forEach((r) => {
    if (!uniqueParents.has(r.parentChunkId)) {
      uniqueParents.set(r.parentChunkId, []);
    }
    uniqueParents.get(r.parentChunkId)?.push({ smallChunkId: r.smallChunkId, similarityScore: r.similarityScore });
  });

  return (
    <div className="space-y-3">
      {Array.from(uniqueParents.entries()).map(([parentId, smallChunks], index) => (
        <motion.div
          key={parentId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-start gap-2"
        >
          {/* Small chunks */}
          <div className="flex flex-col gap-1">
            {smallChunks.map((sc, i) => (
              <motion.div
                key={sc.smallChunkId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {sc.smallChunkId.slice(0, 6)}... ({(sc.similarityScore * 100).toFixed(0)}%)
              </motion.div>
            ))}
          </div>

          {/* Arrow */}
          <motion.div
            animate={isActive ? { x: [0, 5, 0] } : {}}
            transition={{ duration: 0.5, repeat: isActive ? Infinity : 0 }}
            className="mt-2"
          >
            <ArrowRight className="w-5 h-5 text-blue-500" />
          </motion.div>

          {/* Parent chunk */}
          <div className="flex-1 px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
            父块: {parentId.slice(0, 8)}...
          </div>
        </motion.div>
      ))}
    </div>
  );
};

/**
 * RetrievalFlow component
 * Visualizes the retrieval process with step-by-step animation
 */
const RetrievalFlow: React.FC = () => {
  const {
    currentQuery,
    isRunning,
    matches,
    results,
    currentStep,
    embeddingProgress,
    duration,
  } = useRetrievalStore();

  const { messages } = useChatStore();

  // If no query has been made, show placeholder
  if (!currentQuery && messages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        发送问题后查看检索流程可视化。
      </div>
    );
  }

  // If no current query but has messages, show last query
  const displayQuery = currentQuery ?? messages[messages.length - 1]?.content ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          检索流程
        </h2>
        {duration && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            完成耗时 {duration}ms
          </span>
        )}
      </div>

      {/* Query display */}
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">当前查询</span>
        <p className="text-gray-900 dark:text-white font-medium">{displayQuery}</p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {/* Step 1: Embedding */}
        <StepCard
          title="1. 查询向量化"
          status={
            currentStep === 'embedding' ? 'active' :
            currentStep === 'searching' || currentStep === 'expanding' || currentStep === 'complete' ? 'completed' : 'pending'
          }
        >
          <QueryEmbedding
            query={displayQuery}
            isActive={currentStep === 'embedding'}
            progress={currentStep === 'embedding' ? embeddingProgress : currentStep !== 'idle' ? 100 : 0}
          />
        </StepCard>

        {/* Step 2: Similarity Search */}
        <StepCard
          title="2. 相似度搜索"
          status={
            currentStep === 'searching' ? 'active' :
            currentStep === 'expanding' || currentStep === 'complete' ? 'completed' : 'pending'
          }
        >
          <SimilaritySearch
            matches={matches}
            isActive={currentStep === 'searching'}
          />
        </StepCard>

        {/* Step 3: Parent Expansion */}
        <StepCard
          title="3. 父块展开"
          status={
            currentStep === 'expanding' ? 'active' :
            currentStep === 'complete' ? 'completed' : 'pending'
          }
        >
          <ParentExpansion
            results={results}
            isActive={currentStep === 'expanding'}
          />
        </StepCard>
      </div>

      {/* Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              检索结果 ({results.length}个)
            </h3>
            <div className="space-y-2">
              {results.map((result, index) => (
                <motion.div
                  key={result.smallChunkId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500">{result.smallChunkId.slice(0, 8)}...</span>
                    <span className={`text-xs font-medium ${
                      result.similarityScore >= 0.8 ? 'text-green-600' : result.similarityScore >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(result.similarityScore * 100).toFixed(0)}% 相似度
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {result.parentChunkContent.slice(0, 150)}...
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetrievalFlow;