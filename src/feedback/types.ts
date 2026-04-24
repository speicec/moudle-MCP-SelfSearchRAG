/**
 * Feedback Types - 反馈和审核队列类型定义
 *
 * 用于 HumanReviewQueue 和 FeedbackAnalyzer
 */

import type { AlertEvent } from '../alert/types.js';

// ==================== Review Status Types ====================

/**
 * ReviewStatus - 审核状态
 */
export type ReviewStatus = 'pending' | 'assigned' | 'reviewed' | 'resolved';

/**
 * ReviewPriority - 审核优先级
 */
export type ReviewPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * ReviewResult - 审核结果
 */
export type ReviewResult = 'approved' | 'rejected' | 'modified';

// ==================== Review Item Types ====================

/**
 * ReviewItemDetails - 审核项详情
 */
export interface ReviewItemDetails {
  query: string;
  answer: string;
  safetyScore?: number;
  faithfulness?: number;
  contraindication?: string;
  dangerousAdvice?: string[];
  medicalAccuracy?: {
    score: number;
    terminologyErrors?: string[];
    guidelineViolations?: string[];
  };
  suggestedActions?: string[];
}

/**
 * ReviewItem - 审核项结构
 */
export interface ReviewItem {
  reviewId: string;
  traceId: string;
  evaluationId: string;
  alertId?: string;
  status: ReviewStatus;
  priority: ReviewPriority;
  createdAt: string;
  assignedTo?: string;
  reviewedAt?: string;
  resolvedAt?: string;
  reviewNotes?: string;
  result?: ReviewResult;
  details: ReviewItemDetails;
}

/**
 * ReviewItemInput - 创建审核项的输入
 */
export interface ReviewItemInput {
  traceId: string;
  evaluationId: string;
  alertId?: string;
  priority?: ReviewPriority;
  details: ReviewItemDetails;
}

// ==================== Adjustment Types ====================

/**
 * AdjustmentTarget - Adjustment 作用目标
 */
export type AdjustmentTarget = 'retrieval' | 'generation' | 'evaluation';

/**
 * Adjustment - 调整信号
 *
 * 由 FeedbackAnalyzer 生成，用于动态调整系统参数
 */
export interface Adjustment {
  target: AdjustmentTarget;
  change: Record<string, unknown>;
  reason: string;
  expiresAt: number; // 过期时间戳 (毫秒)
}

/**
 * SessionConfig - 会话配置
 */
export interface SessionConfig {
  sessionId: string;
  adjustments: Adjustment[];
  createdAt: number;
  updatedAt: number;
}

// ==================== Flag Types ====================

/**
 * FlagType - 反馈标记类型
 */
export type FlagType =
  | 'HUMAN_REVIEW_REQUIRED'
  | 'ATTENTION_REQUIRED'
  | 'SYSTEM_DEGRADATION';

/**
 * FlagToAlertMapping - Flag 与 Alert 的映射
 */
export const FLAG_TO_ALERT_MAPPING: Record<FlagType, string> = {
  HUMAN_REVIEW_REQUIRED: 'SAFETY_CRITICAL',
  ATTENTION_REQUIRED: 'FAITHFULNESS_LOW',
  SYSTEM_DEGRADATION: 'HIGH_FAILURE_RATE',
};

// ==================== Trend Analysis Types ====================

/**
 * TrendDirection - 趋势方向
 */
export type TrendDirection = 'improving' | 'stable' | 'degrading';

/**
 * EvaluationTrend - 评估趋势
 */
export interface EvaluationTrend {
  metric: string;
  currentValue: number;
  previousValue: number;
  trendDirection: TrendDirection;
  degradationRate?: number;
  samplesCount: number;
}

// ==================== Feedback Analysis Types ====================

/**
 * FeedbackSignal - 反馈信号
 */
export interface FeedbackSignal {
  flags: FlagType[];
  adjustments: Adjustment[];
  trendAnalysis?: EvaluationTrend;
}

/**
 * FeedbackAnalyzerResult - FeedbackAnalyzer 输出
 */
export interface FeedbackAnalyzerResult {
  traceId: string;
  evaluationId: string;
  timestamp: number;
  signal: FeedbackSignal;
}

// ==================== Helper Functions ====================

/**
 * 生成审核项 ID
 */
export function generateReviewId(traceId: string): string {
  const timestamp = Date.now();
  return `review-${traceId}-${timestamp}`;
}

/**
 * 从告警创建审核项详情
 */
export function createReviewDetailsFromAlert(alert: AlertEvent, query: string, answer: string): ReviewItemDetails {
  const details: ReviewItemDetails = {
    query,
    answer,
    suggestedActions: alert.suggestedActions,
  };

  // 根据告警类型填充详情
  switch (alert.type) {
    case 'SAFETY_CRITICAL':
      details.safetyScore = (alert.details as { safetyScore: number }).safetyScore;
      {
        const contraindication = (alert.details as { contraindication?: string }).contraindication;
        if (contraindication) details.contraindication = contraindication;
      }
      {
        const dangerousAdvice = (alert.details as { dangerousAdvice?: string[] }).dangerousAdvice;
        if (dangerousAdvice) details.dangerousAdvice = dangerousAdvice;
      }
      break;
    case 'FAITHFULNESS_LOW':
      details.faithfulness = (alert.details as { value: number }).value;
      break;
    case 'MEDICAL_ACCURACY':
      {
        const terminologyErrors = (alert.details as { terminologyErrors?: string[] }).terminologyErrors;
        const guidelineViolations = (alert.details as { guidelineViolations?: string[] }).guidelineViolations;
        details.medicalAccuracy = {
          score: (alert.details as { value: number }).value,
          ...(terminologyErrors && { terminologyErrors }),
          ...(guidelineViolations && { guidelineViolations }),
        };
      }
      break;
  }

  return details;
}

/**
 * 根据告警严重程度确定审核优先级
 */
export function determineReviewPriority(alert: AlertEvent): ReviewPriority {
  if (alert.severity === 'critical') {
    return 'critical';
  }
  if (alert.type === 'SAFETY_CRITICAL') {
    return 'critical';
  }
  if (alert.severity === 'warning') {
    return 'high';
  }
  return 'medium';
}