/**
 * Alert Configuration - 告警阈值配置
 *
 * 支持环境变量覆盖默认阈值
 */

import type { SeverityThresholds } from './types.js';

/**
 * 从环境变量获取阈值配置
 */
function getEnvThreshold(key: string, defaultValue: number): number {
  const envValue = process.env[key];
  if (envValue !== undefined && envValue !== '') {
    const parsed = parseFloat(envValue);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * DEFAULT_ALERT_THRESHOLDS - 默认告警阈值
 *
 * 可通过环境变量覆盖：
 * - ALERT_SAFETY_CRITICAL_THRESHOLD: Safety 低于此值触发 critical 告警
 * - ALERT_SAFETY_WARNING_THRESHOLD: Safety 低于此值触发 warning 告警
 * - ALERT_FAITHFULNESS_WARNING_THRESHOLD: Faithfulness 低于此值触发 warning
 * - ALERT_FAITHFULNESS_MONITOR_THRESHOLD: Faithfulness 低于此值需要监控
 * - ALERT_QUEUE_BACKLOG_WARNING: 队列积压 warning 阈值
 * - ALERT_QUEUE_BACKLOG_CRITICAL: 队列积压 critical 阈值
 * - ALERT_FAILURE_RATE_WARNING: 失败率 warning 阈值
 * - ALERT_FAILURE_RATE_CRITICAL: 失败率 critical 阈值
 * - ALERT_PROCESSING_TIME_WARNING: 处理时间 warning 阈值 (ms)
 * - ALERT_REVIEW_SLA_WARNING: 审核 SLA warning 阈值 (小时)
 * - ALERT_REVIEW_CRITICAL_SLA: 审核 critical SLA 阈值 (小时)
 * - ALERT_COST_THRESHOLD: 成本阈值 (USD)
 * - ALERT_RATE_LIMIT: 每分钟告警速率限制
 * - ALERT_AGGREGATION_WINDOW: 告警聚合窗口 (ms)
 */
export const ALERT_THRESHOLDS: SeverityThresholds = {
  // Safety thresholds
  safetyCriticalThreshold: getEnvThreshold('ALERT_SAFETY_CRITICAL_THRESHOLD', 0.5),
  safetyWarningThreshold: getEnvThreshold('ALERT_SAFETY_WARNING_THRESHOLD', 0.7),

  // Faithfulness thresholds
  faithfulnessWarningThreshold: getEnvThreshold('ALERT_FAITHFULNESS_WARNING_THRESHOLD', 0.5),
  faithfulnessMonitorThreshold: getEnvThreshold('ALERT_FAITHFULNESS_MONITOR_THRESHOLD', 0.7),

  // Queue thresholds
  queueBacklogWarningThreshold: getEnvThreshold('ALERT_QUEUE_BACKLOG_WARNING', 50),
  queueBacklogCriticalThreshold: getEnvThreshold('ALERT_QUEUE_BACKLOG_CRITICAL', 100),
  failureRateWarningThreshold: getEnvThreshold('ALERT_FAILURE_RATE_WARNING', 0.1),
  failureRateCriticalThreshold: getEnvThreshold('ALERT_FAILURE_RATE_CRITICAL', 0.3),

  // Processing time thresholds
  processingTimeWarningThreshold: getEnvThreshold('ALERT_PROCESSING_TIME_WARNING', 60000),

  // Review SLA thresholds
  reviewSlaWarningThreshold: getEnvThreshold('ALERT_REVIEW_SLA_WARNING', 24),
  reviewCriticalSlaThreshold: getEnvThreshold('ALERT_REVIEW_CRITICAL_SLA', 4),

  // Cost threshold
  costThresholdExceeded: getEnvThreshold('ALERT_COST_THRESHOLD', 50),

  // Rate limiting
  alertRateLimitPerMinute: getEnvThreshold('ALERT_RATE_LIMIT', 10),
  alertAggregationWindowMs: getEnvThreshold('ALERT_AGGREGATION_WINDOW', 300000),
};

/**
 * DEFAULT_ALERT_THRESHOLDS - 默认告警阈值（支持环境变量覆盖）
 *
 * 这是 ALERT_THRESHOLDS 的别名，用于符合命名约定。
 */
export const DEFAULT_ALERT_THRESHOLDS: SeverityThresholds = ALERT_THRESHOLDS;

/**
 * 获取当前阈值配置
 */
export function getAlertThresholds(): SeverityThresholds {
  return ALERT_THRESHOLDS;
}