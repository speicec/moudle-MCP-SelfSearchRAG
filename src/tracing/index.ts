/**
 * Tracing Module - 追踪模块入口
 *
 * 提供 RAG 评估体系 + Agent 链路追踪系统的核心功能
 */

// Core Types
export type {
  TraceSpan,
  RetrievedChunk,
  LLMCallRecord,
  LLMProvider,
  TraceContextData,
  EvaluationResult,
  FaithfulnessVerdict,
  EvaluationTrendData,
  EvaluationMetrics,
  TraceMetrics,
  AggregationEvent,
  // Extended Types
  MedicalAccuracyResult,
  SafetyAssessmentResult,
  EvidenceTraceabilityResult,
  CompletenessResult,
  TerminologyAccuracyResult,
  EvaluationWeights,
  RiskLevel,
  ExtendedEvaluationResult,
} from './types.js';

export { WEIGHT_PRESETS } from './types.js';

// TraceContext
export { TraceContext, createTraceContext } from './TraceContext.js';

// TraceStorage
export { TraceStorage, createTraceStorage } from './TraceStorage.js';

// MetricsAggregator
export {
  MetricsAggregator,
  createMetricsAggregator,
  type RiskLevelDistribution,
  type ComprehensiveMetrics,
} from './MetricsAggregator.js';

// TraceExporter
export {
  TraceExporter,
  createTraceExporter,
  type TraceExporterConfig,
} from './TraceExporter.js';