/**
 * Agent Types - Agent 类型定义
 *
 * 定义医学 Agent 的状态、动作和结果类型
 */

import type { MedicalEntities, MedicalAnswer, SourceCitation, EvidenceEvaluation } from '../types.js';
import type { SafetyAssessment } from '../safety-layer.js';
import type { ExtractedThreshold } from '../threshold-extractor.js';

// Re-export types used by Agent module
export type { MedicalEntities, MedicalAnswer, SourceCitation, EvidenceEvaluation } from '../types.js';
export type { SafetyAssessment } from '../safety-layer.js';
export type { ExtractedThreshold } from '../threshold-extractor.js';

/**
 * Agent 状态
 */
export interface AgentState {
  // 基本信息
  query: string;
  iteration: number;
  maxIterations: number;

  // 实体识别结果
  entities: MedicalEntities;

  // 提取的阈值条件
  thresholds?: ExtractedThreshold[];

  // 安全预检查结果
  safetyAssessment?: SafetyAssessment;

  // 证据评估结果
  evidenceEvaluation?: EvidenceEvaluation[];

  // 检索结果
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
    similarityScore?: number;
  }>;

  // 推理追踪
  reasoningTrace: ReasoningStep[];

  // 当前状态
  status: AgentStatus;
  satisfied: boolean;

  // 生成的回答
  answer?: MedicalAnswer;

  // 错误信息
  error?: string;
}

/**
 * Agent 状态枚举
 */
export type AgentStatus =
  | 'initialized'    // 初始化
  | 'thinking'       // 思考中
  | 'acting'         // 执行动作
  | 'observing'      // 观察结果
  | 'deciding'       // 决策中
  | 'answering'      // 生成回答
  | 'completed'      // 完成
  | 'failed';        // 失败

/**
 * 推理步骤
 */
export interface ReasoningStep {
  iteration: number;
  timestamp: string;
  action: AgentAction;
  observation?: Observation;
  decision?: AgentDecision;
}

/**
 * Agent 动作
 */
export interface AgentAction {
  type: AgentActionType;
  params?: Record<string, unknown>;
  reason: string;
}

/**
 * Agent 动作类型
 */
export type AgentActionType =
  | 'extract_entities'   // 提取实体
  | 'retrieve'           // 执行检索
  | 'expand_query'       // 扩展查询
  | 'evaluate'           // 评估证据
  | 'generate_answer';   // 生成回答

/**
 * 观察
 */
export interface Observation {
  type: 'retrieval' | 'entity' | 'evaluation' | 'answer';
  data: unknown;
  success: boolean;
  message?: string;
}

/**
 * Agent 决策
 */
export interface AgentDecision {
  action: AgentActionType | 'stop';
  confidence: number;
  reason: string;
  needsMoreInfo: boolean;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  // 迭代限制
  maxIterations: number;
  confidenceThreshold: number;

  // 检索配置
  retrievalTopK: number;
  retrievalThreshold: number;

  // 推理配置
  enableQualityCheck: boolean;
  enableTraceLogging: boolean;

  // LLM 配置（可选）
  llmConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * 默认 Agent 配置
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 5,
  confidenceThreshold: 0.8,
  retrievalTopK: 10,
  retrievalThreshold: 0.3,
  enableQualityCheck: true,
  enableTraceLogging: true,
};

/**
 * Agent 结果
 */
export interface AgentResult {
  // 最终回答
  answer: MedicalAnswer;

  // 实体信息
  entities: MedicalEntities;

  // 检索结果
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }> | undefined;

  // 执行统计
  stats: {
    iterations: number;
    actionsExecuted: number;
    retrievalCalls: number;
    llmCalls: number;
    totalTimeMs: number;
  };

  // 推理轨迹
  reasoningTrace: ReasoningStep[];

  // 状态
  success: boolean;
  satisfied: boolean;
  error?: string | undefined;
  fallbackReason?: string | undefined;
}

/**
 * Agent 执行上下文
 */
export interface AgentContext {
  // 检索服务
  retrieval: (query: string, options?: { topK?: number; threshold?: number }) => Promise<Array<{
    content: string;
    source: SourceCitation;
  }>>;

  // LLM 推理器
  reasoner: {
    reasonClinical: (state: AgentState) => Promise<AgentDecision>;
    decide: (state: AgentState) => Promise<boolean>;
    generateAnswer: (
      entities: MedicalEntities,
      retrievalResults?: Array<{
        content: string;
        source: SourceCitation;
      }>,
      safetyAssessment?: SafetyAssessment,
      evidenceEvaluation?: EvidenceEvaluation[],
    ) => Promise<MedicalAnswer>;
    checkQuality: (answer: MedicalAnswer) => Promise<{
      isValid: boolean;
      issues: string[];
      suggestions: string[];
    }>;
  };

  // 实体提取
  extractEntities: (query: string) => MedicalEntities;

  // 查询构建
  buildQueryStrategy: (entities: MedicalEntities) => {
    primaryQuery: string;
    expandedTerms: string[];
  };
}