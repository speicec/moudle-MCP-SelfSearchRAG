/**
 * Monitor Types - 队列健康监控类型定义
 */

/**
 * QueueHealthStatus - 队列健康状态
 */
export type QueueHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * QueueStats - 队列统计数据
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/**
 * WorkerMetrics - Worker 指标
 */
export interface WorkerMetrics {
  activeWorkers: number;
  expectedReplicas: number;
  avgProcessingTimeMs: number;
  throughput: number; // tasks per minute
}

/**
 * QueueHealthReport - 队列健康报告
 */
export interface QueueHealthReport {
  status: QueueHealthStatus;
  stats: QueueStats;
  metrics: WorkerMetrics;
  issues: QueueIssue[];
  timestamp: number;
}

/**
 * QueueIssue - 队列问题
 */
export interface QueueIssue {
  type: 'backlog' | 'high_failure_rate' | 'no_workers' | 'slow_processing' | 'failure_spike';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: Record<string, unknown>;
  suggestedActions: string[];
}

/**
 * HealthThresholds - 健康检测阈值
 */
export interface HealthThresholds {
  backlogWarning: number; // waiting > 50
  backlogCritical: number; // waiting > 100
  failureRateWarning: number; // 10%
  failureRateCritical: number; // 30%
  processingTimeWarningMs: number; // 60s
  noWorkersCritical: boolean; // active = 0
}

/**
 * DEFAULT_HEALTH_THRESHOLDS - 默认健康阈值
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  backlogWarning: 50,
  backlogCritical: 100,
  failureRateWarning: 0.1,
  failureRateCritical: 0.3,
  processingTimeWarningMs: 60000,
  noWorkersCritical: true,
};