/**
 * 执行 Types - 执行流程类型定义
 *
 * 定义 Task DAG、Executor State 和 Planning 相关类型
 */

import type { MedicalEntities, SourceCitation } from '../types.js';

// ==================== Complexity Types ====================

/**
 * 复杂度级别
 */
export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'structured';

/**
 * 触发重规划的原因
 */
export type TriggerReason =
  | 'coverage_threshold'      // 实体覆盖率不足
  | 'evidence_quality'        // 证据质量不足
  | 'execution_failure'       // 执行失败
  | 'critical_entity_missing' // 关键实体缺失
  | 'critical_task_failure';  // 关键任务失败

/**
 * 复杂度评估结果
 */
export interface ComplexityAssessment {
  level: ComplexityLevel;
  entityCount: number;
  hasComparison: boolean;
  hasConditions: boolean;
  hasInteraction: boolean;
  needsPlanning: boolean;
  reason: string;
}

/**
 * 重规划决策
 */
export interface ReplanningDecision {
  shouldReplan: boolean;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  triggers: TriggerReason[];
  compositeScore: number;
  supplementalTasks: AgentTask[];
  limitReached?: string | undefined;
}

/**
 * 规划结果
 */
export interface PlanningResult {
  success: boolean;
  dag?: TaskDAG | undefined;
  complexityLevel: ComplexityLevel;
  matchedTemplate?: string | undefined;
  intentAnalysis: IntentAnalysis;
  validationErrors?: string[] | undefined;
  usedLLM: boolean;
}

// ==================== Task DAG Types ====================

/**
 * Agent 任务
 */
export interface AgentTask {
  id: string;                      // 唯一标识
  type: AgentActionType;           // 任务类型
  params: Record<string, unknown>; // 任务参数
  dependencies: string[];          // 依赖任务ID列表
  priority: number;                // 优先级 1-7
  parallelGroup?: string | undefined;          // 并行组标识
  fallbackStrategy?: FallbackStrategy | undefined;
}

/**
 * 扩展的 Agent 动作类型
 */
export type AgentActionType =
  | 'extract_entities'       // 提取实体
  | 'retrieve'               // 执行检索
  | 'expand_query'           // 扩展查询
  | 'evaluate'               // 评估证据
  | 'generate_answer'        // 生成回答
  | 'calculate_indicator'    // 计算指标阈值
  | 'check_interaction'      // 检查药物相互作用
  | 'check_contraindication';// 检查禁忌

/**
 * 失败回退策略
 */
export interface FallbackStrategy {
  type: 'retry' | 'alternative' | 'skip' | 'abort';
  retryCount?: number;
  alternativeTask?: AgentTask;
}

/**
 * 任务结果
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
  retryCount?: number;
}

/**
 * Task DAG
 */
export interface TaskDAG {
  tasks: AgentTask[];
  parallelGroups: string[];        // 并行组ID列表
  entryTasks: string[];            // 入口任务（无依赖）
  exitTasks: string[];             // 出口任务（无下游）
}

// ==================== Executor State Types ====================

/**
 * 执行器状态
 */
export interface ExecutorState {
  dag: TaskDAG;
  completed: Map<string, TaskResult>;
  pending: string[];
  running: string[];
  failed: string[];
  status: 'initialized' | 'running' | 'completed' | 'failed' | 'replanning';
  startTime: number;
  currentRound: number;
  entities: MedicalEntities;
  query: string;
  contextEntries: ContextEntry[];
}

/**
 * 上下文条目
 */
export interface ContextEntry {
  id: string;
  type: 'retrieval' | 'evaluation' | 'reasoning' | 'error';
  content: string;
  source?: SourceCitation | undefined;
  tokens: number;
  priority: number;        // 1 = 最高（指南），0.5 = 基准
  confidence: number;      // 置信度 0-1
  compressed?: boolean | undefined;
}

/**
 * 执行摘要
 */
export interface ExecutionSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  parallelTasks: number;
  totalDurationMs: number;
  llmCallCount: number;
  replanningRounds: number;
  compositeScore: number;
  coverage: number;
  highConfidenceRatio: number;
}

// ==================== Intent Analysis Types ====================

/**
 * 查询类型
 */
export type QueryType =
  | 'information_query'     // 信息查询
  | 'decision_support'      // 决策支持
  | 'safety_check'          // 安全检查
  | 'comparison';           // 对比查询

/**
 * 检索需求级别
 */
export type RetrievalNeedLevel = 'required' | 'recommended' | 'optional';

/**
 * 意图分析结果
 */
export interface IntentAnalysis {
  queryTypes: QueryType[];
  primaryFocusEntity: string;
  secondaryFocusEntities: string[];
  retrievalNeeds: Record<string, RetrievalNeedLevel>;
  specialNeeds: {
    calculateIndicator: boolean;
    checkInteraction: boolean;
    checkContraindication: boolean;
    requireYearFilter: boolean;
    yearValue?: number | undefined;
  };
  expectedAnswerFormat: 'direct' | 'comparison' | 'recommendation' | 'safety_warning';
}

// ==================== Constants ====================

/**
 * 同类型并行限制
 */
export const PARALLEL_TYPE_LIMITS: Record<AgentActionType, number> = {
  extract_entities: 1,
  retrieve: 3,
  expand_query: 1,
  evaluate: 2,
  generate_answer: 1,
  calculate_indicator: 1,
  check_interaction: 1,
  check_contraindication: 2,
};

/**
 * 工具参数 Schema
 */
export const TOOL_PARAM_SCHEMA: Record<AgentActionType, { required: string[]; optional: string[] }> = {
  extract_entities: {
    required: ['query'],
    optional: [],
  },
  retrieve: {
    required: ['query'],
    optional: ['topK', 'threshold', 'filters'],
  },
  expand_query: {
    required: ['query'],
    optional: ['strategy'],
  },
  evaluate: {
    required: ['results'],
    optional: ['criteria'],
  },
  generate_answer: {
    required: ['context'],
    optional: ['format', 'maxTokens'],
  },
  calculate_indicator: {
    required: ['indicator', 'value'],
    optional: ['unit'],
  },
  check_interaction: {
    required: ['drug1', 'drug2'],
    optional: ['source'],
  },
  check_contraindication: {
    required: ['drug'],
    optional: ['condition', 'indicator', 'threshold'],
  },
};

/**
 * DAG 验证错误类型
 */
export type DAGValidationErrorType =
  | 'duplicate_task_id'
  | 'missing_dependency'
  | 'circular_dependency'
  | 'self_dependency'
  | 'parallel_internal_dependency'
  | 'same_type_parallel_limit'
  | 'priority_order_violation'
  | 'unknown_tool_type'
  | 'missing_required_param';

/**
 * DAG 验证错误
 */
export interface DAGValidationError {
  type: DAGValidationErrorType;
  taskId?: string;
  message: string;
  suggestion: string;
  autoCorrectable: boolean;
  cyclePath?: string[];
}

/**
 * DAG 统计信息
 */
export interface DAGStats {
  taskCount: number;
  maxDepth: number;
  criticalPathLength: number;
  parallelGroupCount: number;
  typeDistribution: Record<AgentActionType, number>;
}

/**
 * 上下文管理器配置
 */
export interface ContextManagerConfig {
  maxTokens: number;             // 上下文上限
  reserveForOutput: number;      // 输出预留
  compressionThreshold: number;  // 压缩触发阈值
}

/**
 * 默认上下文配置
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  maxTokens: 60000,
  reserveForOutput: 4000,
  compressionThreshold: 0.8,
};

/**
 * 重规划限制配置
 */
export interface ReplanningLimits {
  maxReplanRounds: number;
  maxSupplementalTasks: number;
  convergenceThreshold: number;
  cooldownMs: number;
}

/**
 * 默认重规划限制
 */
export const DEFAULT_REPLANNING_LIMITS: ReplanningLimits = {
  maxReplanRounds: 2,
  maxSupplementalTasks: 3,
  convergenceThreshold: 0.05,
  cooldownMs: 500,
};