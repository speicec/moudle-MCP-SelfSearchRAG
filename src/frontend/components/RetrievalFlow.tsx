import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRetrievalStore, useChatStore } from '../store';
import { Check, Loader2, ArrowDown, ArrowRight, Brain, Activity, GitBranch, Search, Zap, Target, FileText, ChevronDown, Copy, Hash } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import type {
  EntityMatch,
  ComplexityAssessment,
  QueryRewriting,
  TemplateAttempt,
  TaskDAG,
  ExecutorState,
  ExecutionMode,
} from '../types/visualization';

/**
 * Agent Mode Panel - 显示执行模式及选择原因
 */
const AgentModePanel: React.FC<{
  mode: ExecutionMode | null;
  reason: string | null;
  matchedTemplate: string | null;
  isActive: boolean;
}> = ({ mode, reason, matchedTemplate, isActive }) => {
  if (!mode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
    >
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          执行模式: {mode === 'planning' ? 'Planning' : 'ReAct'}
        </span>
      </div>
      <div className="text-xs text-indigo-600 dark:text-indigo-400">
        {reason}
      </div>
      {matchedTemplate && (
        <div className="mt-2 text-xs bg-indigo-100 dark:bg-indigo-800/50 rounded px-2 py-1">
          匹配模板: {matchedTemplate}
        </div>
      )}
    </motion.div>
  );
};

/**
 * Entity Recognition Panel - 显示疾病、药物、指标实体
 */
const EntityRecognitionPanel: React.FC<{
  entityMatches: EntityMatch[];
  isActive: boolean;
}> = ({ entityMatches, isActive }) => {
  if (entityMatches.length === 0) return null;

  const groupedEntities = {
    diseases: entityMatches.filter(e => e.entityType === 'disease'),
    drugs: entityMatches.filter(e => e.entityType === 'drug'),
    indicators: entityMatches.filter(e => e.entityType === 'indicator'),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700"
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          实体识别 ({entityMatches.length}个)
        </span>
      </div>

      <div className="space-y-2">
        {groupedEntities.diseases.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 px-2 py-1 rounded">疾病</span>
            <div className="flex flex-wrap gap-1">
              {groupedEntities.diseases.map((e, i) => (
                <span key={i} className="text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded border">
                  {e.matchedTerm} → {e.canonicalName}
                </span>
              ))}
            </div>
          </div>
        )}

        {groupedEntities.drugs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">药物</span>
            <div className="flex flex-wrap gap-1">
              {groupedEntities.drugs.map((e, i) => (
                <span key={i} className="text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded border">
                  {e.matchedTerm} → {e.canonicalName}
                </span>
              ))}
            </div>
          </div>
        )}

        {groupedEntities.indicators.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300 px-2 py-1 rounded">指标</span>
            <div className="flex flex-wrap gap-1">
              {groupedEntities.indicators.map((e, i) => (
                <span key={i} className="text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded border">
                  {e.matchedTerm} → {e.canonicalName}
                  {e.value !== undefined && <span className="text-gray-500"> ({e.value}{e.unit})</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Complexity Assessment Panel - 显示复杂度评估结果
 */
const ComplexityPanel: React.FC<{
  complexity: ComplexityAssessment | null;
  isActive: boolean;
}> = ({ complexity, isActive }) => {
  if (!complexity) return null;

  const levelColors = {
    simple: 'bg-green-100 text-green-700 dark:bg-green-800/50 dark:text-green-300',
    moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800/50 dark:text-yellow-300',
    complex: 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            复杂度评估
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[complexity.level]}`}>
          {complexity.level}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">实体数量:</span>
          <span className="font-medium">{complexity.entityCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">需要规划:</span>
          <span className={`font-medium ${complexity.needsPlanning ? 'text-red-500' : 'text-green-500'}`}>
            {complexity.needsPlanning ? '是' : '否'}
          </span>
        </div>
        {complexity.hasComparison && (
          <div className="text-xs text-orange-600 dark:text-orange-400">包含比较</div>
        )}
        {complexity.hasConditions && (
          <div className="text-xs text-orange-600 dark:text-orange-400">包含条件</div>
        )}
        {complexity.hasInteraction && (
          <div className="text-xs text-orange-600 dark:text-orange-400">包含交互</div>
        )}
      </div>

      <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-800/30 rounded px-2 py-1">
        {complexity.reason}
      </div>
    </motion.div>
  );
};

/**
 * Query Rewriting Panel - 显示查询改写对比
 */
const QueryRewritingPanel: React.FC<{
  originalQuery: string | null;
  rewriting: QueryRewriting | null;
  isActive: boolean;
}> = ({ originalQuery, rewriting, isActive }) => {
  if (!rewriting) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700"
    >
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-cyan-500" />
        <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
          查询优化
        </span>
      </div>

      <div className="space-y-2">
        {originalQuery && (
          <div className="text-xs">
            <span className="text-gray-500 block mb-1">原始查询:</span>
            <div className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-700 dark:text-gray-300">
              {originalQuery}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="text-xs">
          <span className="text-cyan-500 block mb-1">优化查询:</span>
          <div className="bg-cyan-100 dark:bg-cyan-800/50 rounded px-2 py-1 text-cyan-700 dark:text-cyan-300">
            {rewriting.primaryQuery}
          </div>
        </div>

        {rewriting.expandedTerms.length > 0 && (
          <div className="text-xs">
            <span className="text-gray-500 block mb-1">扩展词:</span>
            <div className="flex flex-wrap gap-1">
              {rewriting.expandedTerms.map((term, i) => (
                <span key={i} className="bg-white dark:bg-gray-700 px-2 py-0.5 rounded border text-cyan-600 dark:text-cyan-400">
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Template Matching Panel - 显示模板匹配尝试
 */
const TemplateMatchingPanel: React.FC<{
  templateAttempts: TemplateAttempt[];
  matchedTemplate: string | null;
  isActive: boolean;
}> = ({ templateAttempts, matchedTemplate, isActive }) => {
  if (templateAttempts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700"
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-teal-500" />
        <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
          模板匹配 ({templateAttempts.length}个尝试)
        </span>
      </div>

      <div className="space-y-1">
        {templateAttempts.map((attempt, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
              attempt.matched
                ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span className="font-medium">{attempt.templateName}</span>
            <span className="flex items-center gap-1">
              {attempt.matched ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <span className="text-xs text-red-400">{attempt.rejectionReason || '未匹配'}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {matchedTemplate && (
        <div className="mt-2 text-xs bg-teal-100 dark:bg-teal-800/50 rounded px-2 py-1 text-teal-700 dark:text-teal-300">
          最终匹配: {matchedTemplate}
        </div>
      )}
    </motion.div>
  );
};

/**
 * DAG Visualization Panel - Planning 模式下显示任务 DAG
 */
const DAGVisualizationPanel: React.FC<{
  dag: TaskDAG | null;
  isActive: boolean;
}> = ({ dag, isActive }) => {
  if (!dag) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700"
    >
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          任务 DAG ({dag.tasks.length}个任务)
        </span>
      </div>

      <div className="space-y-1">
        {dag.tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-white dark:bg-gray-700 border"
          >
            <span className="font-mono text-gray-500">{task.id}</span>
            <span className="text-emerald-600 dark:text-emerald-400">{task.type}</span>
            {task.dependencies.length > 0 && (
              <span className="text-xs text-gray-400">
                ← {task.dependencies.join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>

      {dag.parallelGroups.length > 0 && (
        <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          并行组: {dag.parallelGroups.length}组
        </div>
      )}
    </motion.div>
  );
};

/**
 * Execution State Panel - 显示执行进度
 */
const ExecutionStatePanel: React.FC<{
  executorState: ExecutorState | null;
  isActive: boolean;
}> = ({ executorState, isActive }) => {
  if (!executorState) return null;

  const statusColors = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    running: 'bg-blue-100 text-blue-600 dark:bg-blue-800/50 dark:text-blue-300',
    completed: 'bg-green-100 text-green-600 dark:bg-green-800/50 dark:text-green-300',
    failed: 'bg-red-100 text-red-600 dark:bg-red-800/50 dark:text-red-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            执行状态
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[executorState.status]}`}>
          {executorState.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">当前轮次:</span>
          <span className="font-medium ml-1">{executorState.currentRound}</span>
        </div>
        <div>
          <span className="text-gray-500">已完成:</span>
          <span className="font-medium ml-1 text-green-500">{executorState.completedCount}</span>
        </div>
        <div>
          <span className="text-gray-500">失败:</span>
          <span className="font-medium ml-1 text-red-500">{executorState.failedCount}</span>
        </div>
        <div>
          <span className="text-gray-500">运行中:</span>
          <span className="font-medium ml-1 text-blue-500">{executorState.runningTasks.length}</span>
        </div>
      </div>

      {executorState.runningTasks.length > 0 && (
        <div className="mt-2 text-xs">
          <span className="text-gray-500">运行任务:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {executorState.runningTasks.map((taskId) => (
              <span key={taskId} className="bg-blue-100 dark:bg-blue-800/50 px-1 rounded text-blue-600 dark:text-blue-400">
                {taskId}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Agent Result Summary Panel - 显示最终结果摘要
 */
const AgentResultPanel: React.FC<{
  agentResult: NonNullable<ReturnType<typeof useRetrievalStore.getState>['agentResult']>;
}> = ({ agentResult }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
          Agent 执行完成
        </span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          agentResult.satisfied
            ? 'bg-green-100 text-green-600 dark:bg-green-800/50 dark:text-green-300'
            : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-800/50 dark:text-yellow-300'
        }`}>
          {agentResult.satisfied ? '满足' : '部分满足'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">检索数量:</span>
          <span className="font-medium ml-1">{agentResult.retrievalCount}</span>
        </div>
        <div>
          <span className="text-gray-500">耗时:</span>
          <span className="font-medium ml-1">{agentResult.totalTimeMs}ms</span>
        </div>
        {agentResult.iterations !== undefined && (
          <div>
            <span className="text-gray-500">迭代次数:</span>
            <span className="font-medium ml-1">{agentResult.iterations}</span>
          </div>
        )}
        {agentResult.llmCallCount !== undefined && (
          <div>
            <span className="text-gray-500">LLM调用:</span>
            <span className="font-medium ml-1">{agentResult.llmCallCount}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

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
 * Extended with Agent visualization panels
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
    // Agent visualization state
    agentEnabled,
    agentPhase,
    agentQuery,
    entityMatches,
    complexity,
    executionMode,
    executionReason,
    matchedTemplate,
    queryRewriting,
    templateAttempts,
    dag,
    executorState,
    agentResult,
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
        {agentEnabled && (
          <span className="text-xs bg-indigo-100 dark:bg-indigo-800/50 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded">
            Agent 已启用
          </span>
        )}
      </div>

      {/* Query display */}
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">当前查询</span>
        <p className="text-gray-900 dark:text-white font-medium">{displayQuery}</p>
      </div>

      {/* Agent Visualization Section */}
      {agentEnabled && agentPhase && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
            <Brain className="w-4 h-4" />
            <span>Agent 分析阶段</span>
          </div>

          {/* Agent Phase Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Execution Mode Panel */}
            {executionMode && (
              <AgentModePanel
                mode={executionMode}
                reason={executionReason}
                matchedTemplate={matchedTemplate}
                isActive={agentPhase === 'mode'}
              />
            )}

            {/* Entity Recognition Panel */}
            {entityMatches.length > 0 && (
              <EntityRecognitionPanel
                entityMatches={entityMatches}
                isActive={agentPhase === 'entities'}
              />
            )}

            {/* Complexity Assessment Panel */}
            {complexity && (
              <ComplexityPanel
                complexity={complexity}
                isActive={agentPhase === 'complexity'}
              />
            )}

            {/* Query Rewriting Panel */}
            {queryRewriting && (
              <QueryRewritingPanel
                originalQuery={agentQuery}
                rewriting={queryRewriting}
                isActive={agentPhase === 'query_rewrite'}
              />
            )}

            {/* Template Matching Panel */}
            {templateAttempts.length > 0 && (
              <TemplateMatchingPanel
                templateAttempts={templateAttempts}
                matchedTemplate={matchedTemplate}
                isActive={agentPhase === 'template'}
              />
            )}

            {/* DAG Visualization Panel (Planning mode) */}
            {dag && (
              <DAGVisualizationPanel
                dag={dag}
                isActive={agentPhase === 'dag'}
              />
            )}

            {/* Execution State Panel */}
            {executorState && (
              <ExecutionStatePanel
                executorState={executorState}
                isActive={agentPhase === 'execution'}
              />
            )}

            {/* Agent Result Panel */}
            {agentResult && (
              <AgentResultPanel agentResult={agentResult} />
            )}
          </div>
        </div>
      )}

      {/* Traditional Retrieval Steps */}
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
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-500" />
                检索依据 ({results.length}个)
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                点击卡片查看完整内容
              </span>
            </div>
            <div className="space-y-3">
              {results.map((result, index) => (
                <RetrievalResultCard
                  key={result.smallChunkId}
                  result={result}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * RetrievalResultCard - Enhanced expandable card for retrieval results
 * Design: Clinical evidence card aesthetic with expand/collapse functionality
 */
const RetrievalResultCard: React.FC<{
  result: {
    smallChunkId: string;
    parentChunkId: string;
    parentChunkContent: string;
    similarityScore: number;
    sourceDocumentId: string;
  };
  index: number;
}> = ({ result, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Quality level based on similarity
  const qualityLevel = result.similarityScore >= 0.85 ? 'high' :
    result.similarityScore >= 0.70 ? 'medium' :
    result.similarityScore >= 0.50 ? 'low' : 'very-low';

  const qualityConfig = {
    high: { label: '高质量', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-800/50', border: 'border-green-300 dark:border-green-700' },
    medium: { label: '中等质量', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-800/50', border: 'border-blue-300 dark:border-blue-700' },
    low: { label: '低质量', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-800/50', border: 'border-yellow-300 dark:border-yellow-700' },
    'very-low': { label: '参考', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-700' },
  };

  const config = qualityConfig[qualityLevel];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.parentChunkContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate sample-style ID
  const sampleId = `EV-${String(index + 1).padStart(3, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      layout
      className={`rounded-lg border-2 overflow-hidden transition-all duration-200 ${config.border} ${expanded ? 'bg-white dark:bg-gray-900 shadow-md' : 'bg-gray-50 dark:bg-gray-800/50'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-500 text-white rounded text-xs font-mono font-semibold">
            <Hash className="w-3 h-3" />
            <span>{sampleId}</span>
          </div>
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
            {result.parentChunkId.slice(0, 16)}...
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Similarity Score */}
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  qualityLevel === 'high' ? 'bg-green-500' :
                  qualityLevel === 'medium' ? 'bg-blue-500' :
                  qualityLevel === 'low' ? 'bg-yellow-500' : 'bg-gray-400'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${result.similarityScore * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className={`text-sm font-semibold font-mono ${config.color}`}>
              {(result.similarityScore * 100).toFixed(1)}%
            </span>
          </div>

          {/* Quality Badge */}
          <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Toggle Button - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
            {expanded ? '收起内容' : '展开查看完整证据'}
          </span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-800/50"
        >
          <ChevronDown className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </motion.div>
      </button>

      {/* Preview when collapsed */}
      {!expanded && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {result.parentChunkContent.slice(0, 200)}
            {result.parentChunkContent.length > 200 && <span className="text-gray-400">...</span>}
          </p>
        </div>
      )}

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Content Section */}
            <div className="px-4 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Chunk 内容
                </span>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {result.parentChunkContent}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="px-4 py-3 bg-gray-100/50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Small Chunk ID</span>
                  <span className="block font-mono text-gray-700 dark:text-gray-300 mt-1 truncate">
                    {result.smallChunkId}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Parent Chunk ID</span>
                  <span className="block font-mono text-gray-700 dark:text-gray-300 mt-1 truncate">
                    {result.parentChunkId}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Source Document</span>
                  <span className="block font-mono text-gray-700 dark:text-gray-300 mt-1 truncate">
                    {result.sourceDocumentId || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:border-teal-500 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">复制内容</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RetrievalFlow;