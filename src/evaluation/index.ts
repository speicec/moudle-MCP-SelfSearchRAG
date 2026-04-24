/**
 * Evaluation Module - 评估模块入口
 *
 * 提供 RAGAS 评估和医疗扩展评估功能
 */

// Types
export type {
  MedicalAccuracyResult,
  SafetyAssessmentResult,
  EvidenceTraceabilityResult,
  CompletenessResult,
  TerminologyAccuracyResult,
  LayerScores,
  ExtendedEvaluationResult,
  EvaluationConfig,
  RiskLevel,
  FaithfulnessVerdict,
  EvaluationWeights,
} from './types.js';

export {
  DEFAULT_EVALUATION_CONFIG,
  determineRiskLevel,
  calculateLayerScores,
} from './types.js';

// Pipeline
export {
  MedicalEvaluationPipeline,
  createMedicalEvaluationPipeline,
} from './MedicalEvaluationPipeline.js';