/**
 * Alert Types - 告警类型定义
 *
 * 基于 shared-types/spec.md 定义统一的告警类型
 */

// ==================== Alert Type Enumeration ====================

/**
 * AlertType - 告警类型枚举 (17种)
 */
export type AlertType =
  // Evaluation alerts
  | 'SAFETY_CRITICAL'
  | 'FAITHFULNESS_LOW'
  | 'MEDICAL_ACCURACY'
  | 'CONTEXT_IRRELEVANT'
  // Queue alerts
  | 'QUEUE_BACKLOG'
  | 'QUEUE_BACKLOG_TREND'
  | 'HIGH_FAILURE_RATE'
  | 'FAILURE_SPIKE'
  | 'NO_ACTIVE_WORKERS'
  | 'LOW_WORKER_ACTIVITY'
  | 'HIGH_PROCESSING_TIME'
  | 'PROCESSING_TIME_TREND'
  // Review alerts
  | 'REVIEW_SLA_BREACH'
  | 'REVIEW_CRITICAL_SLA'
  // System alerts
  | 'SCALE_FAILURE'
  | 'DRUG_INTERACTION'
  | 'COST_THRESHOLD_EXCEEDED';

/**
 * AlertSeverity - 告警严重程度
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * AlertStatus - 告警状态
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

// ==================== Alert Details Map ====================

/**
 * AlertDetailsMap - 每种告警类型的详情结构
 */
export interface AlertDetailsMap {
  // Evaluation alerts
  SAFETY_CRITICAL: {
    safetyScore: number;
    threshold: number;
    delta: number;
    contraindication?: string;
    dangerousAdvice?: string[];
  };
  FAITHFULNESS_LOW: {
    metric: 'faithfulness';
    value: number;
    threshold: number;
    delta: number;
    unsupportedCount?: number;
    hallucinationRisk?: boolean;
  };
  MEDICAL_ACCURACY: {
    metric: 'medicalAccuracy';
    value: number;
    terminologyErrors?: string[];
    guidelineViolations?: string[];
  };
  CONTEXT_IRRELEVANT: {
    metric: 'contextRelevance';
    value: number;
    threshold: number;
    avgChunkScore?: number;
    suggestedTopK?: number;
  };
  // Queue alerts
  QUEUE_BACKLOG: {
    waiting: number;
    threshold: number;
    active?: number;
  };
  QUEUE_BACKLOG_TREND: {
    waiting: number;
    growthRate: number;
    trendDirection: 'increasing' | 'stable' | 'decreasing';
  };
  HIGH_FAILURE_RATE: {
    failureRate: number;
    failed: number;
    completed: number;
    threshold: number;
  };
  FAILURE_SPIKE: {
    recentFailures: number;
    timeWindow: string;
    failureDetails?: string[];
  };
  NO_ACTIVE_WORKERS: {
    waiting: number;
    active: number;
    expectedReplicas?: number;
  };
  LOW_WORKER_ACTIVITY: {
    active: number;
    expected: number;
    delta: number;
  };
  HIGH_PROCESSING_TIME: {
    avgProcessingTime: number;
    threshold: number;
    unit: 'ms';
  };
  PROCESSING_TIME_TREND: {
    avgProcessingTime: number;
    trendDirection: 'increasing' | 'stable' | 'decreasing';
    rate: number;
  };
  // Review alerts
  REVIEW_SLA_BREACH: {
    reviewId: string;
    pendingDuration: number; // hours
    slaThreshold: number;
    priority: string;
  };
  REVIEW_CRITICAL_SLA: {
    reviewId: string;
    pendingDuration: number; // hours
    slaThreshold: number;
    urgency: 'critical';
  };
  // System alerts
  SCALE_FAILURE: {
    targetReplicas: number;
    error: string;
    dockerResponse?: string;
  };
  DRUG_INTERACTION: {
    drugs: string[];
    interactionType: string;
    severity: 'major' | 'moderate' | 'minor';
    description: string;
  };
  COST_THRESHOLD_EXCEEDED: {
    dailyCost: number;
    threshold: number;
    currency: 'USD';
    tokenCount?: number;
  };
}

// ==================== Alert Event Types ====================

/**
 * AlertEventBase - 告警事件基础结构
 */
export interface AlertEventBase {
  alertId: string;
  timestamp: string;
  type: AlertType;
  severity: AlertSeverity;
  traceId?: string;
  evaluationId?: string;
  status: AlertStatus;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

/**
 * AlertEvent - 完整告警事件
 */
export interface AlertEvent extends AlertEventBase {
  details: AlertDetailsMap[this['type']];
  suggestedActions: string[];
}

// ==================== Threshold Configuration ====================

/**
 * SeverityThresholds - 告警阈值配置
 */
export interface SeverityThresholds {
  // Safety thresholds
  safetyCriticalThreshold: number;
  safetyWarningThreshold: number;

  // Faithfulness thresholds
  faithfulnessWarningThreshold: number;
  faithfulnessMonitorThreshold: number;

  // Queue thresholds
  queueBacklogWarningThreshold: number;
  queueBacklogCriticalThreshold: number;
  failureRateWarningThreshold: number;
  failureRateCriticalThreshold: number;

  // Processing time thresholds
  processingTimeWarningThreshold: number;

  // Review SLA thresholds
  reviewSlaWarningThreshold: number;
  reviewCriticalSlaThreshold: number;

  // Cost threshold
  costThresholdExceeded: number;

  // Rate limiting
  alertRateLimitPerMinute: number;
  alertAggregationWindowMs: number;
}

/**
 * DEFAULT_THRESHOLDS - 默认阈值配置
 */
export const DEFAULT_THRESHOLDS: SeverityThresholds = {
  safetyCriticalThreshold: 0.5,
  safetyWarningThreshold: 0.7,
  faithfulnessWarningThreshold: 0.5,
  faithfulnessMonitorThreshold: 0.7,
  queueBacklogWarningThreshold: 50,
  queueBacklogCriticalThreshold: 100,
  failureRateWarningThreshold: 0.1,
  failureRateCriticalThreshold: 0.3,
  processingTimeWarningThreshold: 60000,
  reviewSlaWarningThreshold: 24,
  reviewCriticalSlaThreshold: 4,
  costThresholdExceeded: 50,
  alertRateLimitPerMinute: 10,
  alertAggregationWindowMs: 300000,
};

// ==================== Suggested Actions Map ====================

/**
 * SUGGESTED_ACTIONS - 每种告警的标准建议操作
 */
export const SUGGESTED_ACTIONS: Record<AlertType, string[]> = {
  SAFETY_CRITICAL: ['阻止答案发布', '立即人工审核', '检查禁忌阈值'],
  FAITHFULNESS_LOW: ['触发二次检索', '标记需要验证', '检查幻觉'],
  MEDICAL_ACCURACY: ['标记术语错误', '建议修正'],
  CONTEXT_IRRELEVANT: ['建议增加 topK', '调整 threshold', '优化检索策略'],
  QUEUE_BACKLOG: ['增加 Worker replicas', '检查 LLM API 延迟'],
  QUEUE_BACKLOG_TREND: ['监控增长趋势', '提前扩容'],
  HIGH_FAILURE_RATE: ['检查 Redis 连接', '检查 LLM API 状态', '暂停新任务'],
  FAILURE_SPIKE: ['查看失败详情', '重启 Worker 服务'],
  NO_ACTIVE_WORKERS: ['检查 Worker 进程状态', '重启 Worker 服务'],
  LOW_WORKER_ACTIVITY: ['检查 Worker 健康', '调整 expectedReplicas'],
  HIGH_PROCESSING_TIME: ['检查 LLM API 延迟', '优化 Prompt 长度'],
  PROCESSING_TIME_TREND: ['监控趋势', '优化评估流程'],
  REVIEW_SLA_BREACH: ['分配审核人员', '升级优先级'],
  REVIEW_CRITICAL_SLA: ['立即分配审核', '通知 Ops 团队'],
  SCALE_FAILURE: ['检查 Docker 状态', '手动扩容'],
  DRUG_INTERACTION: ['标注相互作用', '建议替代方案'],
  COST_THRESHOLD_EXCEEDED: ['检查调用频率', '启用条件触发', '优化 Prompt'],
};

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
  result?: 'approved' | 'rejected' | 'modified';
  details: {
    query: string;
    answer: string;
    safetyScore?: number;
    faithfulness?: number;
    contraindication?: string;
    dangerousAdvice?: string[];
  };
}

// ==================== Scale Event Types ====================

/**
 * ScaleEventType - 扩缩容事件类型
 */
export type ScaleEventType = 'scale_up' | 'scale_down' | 'manual_scale' | 'failed';

/**
 * ScaleEvent - 扩缩容事件记录
 */
export interface ScaleEvent {
  eventId: string;
  timestamp: string;
  type: ScaleEventType;
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  triggeredBy: 'autoscaler' | 'manual';
  success: boolean;
  error?: string;
}