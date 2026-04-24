/**
 * Tracing Types - 追踪类型定义
 *
 * 定义 TraceContext、TraceStorage、EvaluationPipeline 使用的核心类型
 */

import type { MedicalEntities } from '../medical/types.js';
import type { ComplexityAssessment } from '../medical/agent/ExecutionTypes.js';
import type { TracePhase } from '../medical/agent/TraceVisualizer.js';

// Re-export TracePhase from TraceVisualizer for convenience
export type { TracePhase } from '../medical/agent/TraceVisualizer.js';

// ==================== Trace Context Types ====================

/**
 * TraceSpan - 单个阶段的追踪记录
 */
export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  phase: TracePhase;
  startTime: number;
  endTime: number;
  durationMs: number;
  input: unknown;
  output: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * RetrievedChunk - 检索到的 chunk (用于评估)
 */
export interface RetrievedChunk {
  chunkId: string;
  content: string;
  sourceDocumentId?: string;
  sourcePage?: number;
  similarityScore: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  source?: 'dense' | 'sparse' | 'hybrid';
  metadata?: Record<string, unknown>;
}

/**
 * LLM Provider 类型
 */
export type LLMProvider = 'anthropic' | 'openai' | 'deepseek' | 'local';

/**
 * LLMCallRecord - LLM 调用记录
 */
export interface LLMCallRecord {
  callId: string;
  model: string;
  provider: LLMProvider;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  phase?: string;
  promptPreview?: string;
  responsePreview?: string;
}

/**
 * TraceContextData - 完整的追踪数据结构
 */
export interface TraceContextData {
  traceId: string;
  sessionId?: string;
  timestamp?: string;
  query: {
    raw: string;
    rewritten?: string;
    entities?: MedicalEntities;
    complexity?: ComplexityAssessment;
  };
  entities?: MedicalEntities;
  phases: TraceSpan[];
  spans?: TraceSpan[];
  retrieval: {
    chunks: RetrievedChunk[];
    topK: number;
    threshold?: number;
    mode?: 'dense' | 'sparse' | 'hybrid';
  };
  llmCalls: LLMCallRecord[];
  answer: {
    text: string;
    confidence?: number;
    sources?: string[];
  };
  evaluation?: EvaluationResult;
  status: 'running' | 'completed' | 'failed' | 'partial';
  error?: string;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
}

// ==================== Evaluation Types ====================

/**
 * FaithfulnessVerdict - 答案中每个声称的判定
 */
export interface FaithfulnessVerdict {
  claim: string;
  verdict: 'supported' | 'unsupported' | 'partial';
  evidence?: string;
  chunkId?: string;
}

/**
 * EvaluationResult - RAGAS 评估结果
 */
export interface EvaluationResult {
  evaluationId: string;
  traceId: string;
  timestamp: string;
  metrics: {
    faithfulness: {
      score: number;
      verdicts: FaithfulnessVerdict[];
    };
    contextRelevance: {
      score: number;
      chunkScores: number[];
    };
    answerRelevance: {
      score: number;
      generatedQuestions: string[];
    };
    contextRecall?: {
      score: number;
      groundTruth?: string;
    };
  };
  overallScore: number;
  metadata: {
    evaluatorModel: string;
    evaluationDurationMs: number;
    retryCount: number;
  };
}

/**
 * EvaluationTrendData - 评估趋势数据
 */
export interface EvaluationTrendData {
  date: string;
  total_evaluations: number;
  avg_faithfulness: number;
  avg_context_relevance: number;
  avg_answer_relevance: number;
  avg_overall: number;
}

// ==================== Extended Evaluation Types (Phase 2) ====================

/**
 * MedicalAccuracyResult - 医疗准确性评估结果
 */
export interface MedicalAccuracyResult {
  score: number;
  terminologyErrors: string[];
  guidelineViolations: string[];
  corrections: string[];
}

/**
 * SafetyAssessmentResult - 安全评估结果
 */
export interface SafetyAssessmentResult {
  score: number;
  contraindications: {
    type: 'absolute' | 'relative';
    details: string[];
  };
  interactions: string[];
  dangerousAdvice: string[];
}

/**
 * EvidenceTraceabilityResult - 证据可追溯性结果
 */
export interface EvidenceTraceabilityResult {
  score: number;
  citationAccuracy: number;
  missingCitations: string[];
  invalidCitations: string[];
}

/**
 * CompletenessResult - 完整性评估结果
 */
export interface CompletenessResult {
  score: number;
  coveredSubQuestions: string[];
  missingSubQuestions: string[];
  entityCoverage: number;
}

/**
 * TerminologyAccuracyResult - 术语准确性结果
 */
export interface TerminologyAccuracyResult {
  score: number;
  terminologyErrors: string[];
  missingAbbreviationExplanations: string[];
}

/**
 * EvaluationWeights - 评估权重配置
 */
export interface EvaluationWeights {
  faithfulness: number;
  contextRelevance: number;
  answerRelevance: number;
  medicalAccuracy: number;
  safetyAssessment: number;
  evidenceTraceability: number;
  completeness: number;
  terminologyAccuracy: number;
}

/**
 * 预设权重配置
 */
export const WEIGHT_PRESETS: Record<string, EvaluationWeights> = {
  default: {
    faithfulness: 0.25,
    contextRelevance: 0.15,
    answerRelevance: 0.15,
    medicalAccuracy: 0.20,
    safetyAssessment: 0.15,
    evidenceTraceability: 0.10,
    completeness: 0.05,
    terminologyAccuracy: 0.05,
  },
  medicalFocus: {
    faithfulness: 0.20,
    contextRelevance: 0.10,
    answerRelevance: 0.10,
    medicalAccuracy: 0.25,
    safetyAssessment: 0.20,
    evidenceTraceability: 0.10,
    completeness: 0.03,
    terminologyAccuracy: 0.02,
  },
  safetyFirst: {
    faithfulness: 0.15,
    contextRelevance: 0.10,
    answerRelevance: 0.10,
    medicalAccuracy: 0.15,
    safetyAssessment: 0.30,
    evidenceTraceability: 0.10,
    completeness: 0.05,
    terminologyAccuracy: 0.05,
  },
};

/**
 * RiskLevel - 风险等级
 */
export type RiskLevel = 'safe' | 'caution' | 'warning' | 'danger';

/**
 * ExtendedEvaluationResult - 扩展评估结果 (包含医疗维度)
 */
export interface ExtendedEvaluationResult extends EvaluationResult {
  extendedMetrics: {
    medicalAccuracy: MedicalAccuracyResult;
    safetyAssessment: SafetyAssessmentResult;
    evidenceTraceability: EvidenceTraceabilityResult;
    completeness: CompletenessResult;
    terminologyAccuracy: TerminologyAccuracyResult;
  };
  layerScores: {
    layer1: number; // 基础 RAGAS
    layer2: number; // 医疗核心
    layer3: number; // 医疗增强
  };
  riskLevel: RiskLevel;
  weights: EvaluationWeights;
}

// ==================== Metrics Aggregation Types ====================

/**
 * EvaluationMetrics - 评估指标摘要
 */
export interface EvaluationMetrics {
  avgFaithfulness: number;
  avgContextRelevance: number;
  avgAnswerRelevance: number;
  avgOverall: number;
  totalEvaluations: number;
  last7Days: EvaluationTrendData[];
}

/**
 * TraceMetrics - 追踪指标摘要
 */
export interface TraceMetrics {
  totalTraces: number;
  avgDurationMs: number;
  avgLlmCallCount: number;
  successRate: number;
}

/**
 * AggregationEvent - WebSocket 推送事件
 */
export interface AggregationEvent {
  type: 'metrics:update';
  traceId: string;
  evaluation?: {
    overallScore: number;
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
  };
  trace?: {
    status: string;
    durationMs: number;
    llmCallCount: number;
  };
  timestamp: number;
}