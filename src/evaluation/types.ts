/**
 * Evaluation Types - 评估类型定义
 *
 * 定义 RAGAS 评估和医疗扩展评估的所有类型
 */

import type { EvaluationResult, RiskLevel, EvaluationWeights } from '../tracing/types.js';

// Re-export from tracing types for evaluation module
export type {
  FaithfulnessVerdict,
  EvaluationWeights,
  RiskLevel,
} from '../tracing/types.js';

// ==================== Extended Evaluation Types ====================

/**
 * MedicalAccuracyResult - 医疗准确性评估结果
 */
export interface MedicalAccuracyResult {
  score: number;
  terminologyErrors: string[];
  guidelineViolations: string[];
  corrections: string[];
  details: {
    terminologyMatch: number;
    guidelineAdherence: number;
  };
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
  riskFactors: string[];
}

/**
 * EvidenceTraceabilityResult - 证据可追溯性结果
 */
export interface EvidenceTraceabilityResult {
  score: number;
  citationAccuracy: number;
  missingCitations: string[];
  invalidCitations: string[];
  sourceQuality: {
    hasGuideline: boolean;
    hasRecentSource: boolean;
    hasAuthoritativeSource: boolean;
  };
}

/**
 * CompletenessResult - 完整性评估结果
 */
export interface CompletenessResult {
  score: number;
  coveredSubQuestions: string[];
  missingSubQuestions: string[];
  entityCoverage: number;
  topicCoverage: number;
}

/**
 * TerminologyAccuracyResult - 术语准确性结果
 */
export interface TerminologyAccuracyResult {
  score: number;
  terminologyErrors: string[];
  missingAbbreviationExplanations: string[];
  correctUsageCount: number;
  errorCount: number;
}

/**
 * LayerScores - 分层评估分数
 */
export interface LayerScores {
  layer1: number; // 基础 RAGAS: faithfulness, context_relevance, answer_relevance
  layer2: number; // 医疗核心: medical_accuracy, safety_assessment
  layer3: number; // 医疗增强: evidence_traceability, completeness, terminology_accuracy
}

/**
 * ExtendedEvaluationResult - 扩展评估结果
 */
export interface ExtendedEvaluationResult extends EvaluationResult {
  extendedMetrics: {
    medicalAccuracy: MedicalAccuracyResult;
    safetyAssessment: SafetyAssessmentResult;
    evidenceTraceability: EvidenceTraceabilityResult;
    completeness: CompletenessResult;
    terminologyAccuracy: TerminologyAccuracyResult;
  };
  layerScores: LayerScores;
  riskLevel: RiskLevel;
  weights: EvaluationWeights;
}

// ==================== Evaluation Configuration ====================

/**
 * 评估配置
 */
export interface EvaluationConfig {
  // LLM 配置
  llmConfig: {
    model: string;
    provider: string;
    retryCount: number;
  };

  // 权重配置
  weights: EvaluationWeights;

  // 阈值配置
  thresholds: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    overall: number;
    safetyCritical: number;
  };

  // 评估模式
  mode: 'full' | 'basic' | 'medical';
}

/**
 * 默认评估配置
 */
export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  llmConfig: {
    model: 'deepseek-reasoner',
    provider: 'deepseek',
    retryCount: 3,
  },
  weights: {
    faithfulness: 0.20,
    contextRelevance: 0.10,
    answerRelevance: 0.10,
    medicalAccuracy: 0.20,
    safetyAssessment: 0.20,
    evidenceTraceability: 0.10,
    completeness: 0.05,
    terminologyAccuracy: 0.05,
  },
  thresholds: {
    faithfulness: 0.7,
    contextRelevance: 0.6,
    answerRelevance: 0.6,
    overall: 0.65,
    safetyCritical: 0.5,
  },
  mode: 'full',
};

// ==================== Helper Functions ====================

/**
 * 确定风险等级
 */
export function determineRiskLevel(scores: {
  faithfulness: number;
  safetyAssessment: number;
  overall: number;
}): RiskLevel {
  if (scores.safetyAssessment < 0.5) return 'danger';
  if (scores.faithfulness < 0.5 || scores.safetyAssessment < 0.7) return 'warning';
  if (scores.faithfulness < 0.7 || scores.safetyAssessment < 0.85) return 'caution';
  return 'safe';
}

/**
 * 计算分层分数
 */
export function calculateLayerScores(
  metrics: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    medicalAccuracy: number;
    safetyAssessment: number;
    evidenceTraceability: number;
    completeness: number;
    terminologyAccuracy: number;
  }
): LayerScores {
  return {
    layer1: (metrics.faithfulness + metrics.contextRelevance + metrics.answerRelevance) / 3,
    layer2: (metrics.medicalAccuracy + metrics.safetyAssessment) / 2,
    layer3: (metrics.evidenceTraceability + metrics.completeness + metrics.terminologyAccuracy) / 3,
  };
}