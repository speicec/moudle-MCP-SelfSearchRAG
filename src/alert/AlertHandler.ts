/**
 * AlertHandler - 告警处理器核心类
 *
 * 负责检测评估结果中的异常情况，创建告警，广播通知，存储告警历史
 */

import type { TraceStorage } from '../tracing/TraceStorage.js';
import type {
  EvaluationResult,
  FaithfulnessVerdict,
  MedicalAccuracyResult,
} from '../tracing/types.js';
import type {
  AlertEvent,
  AlertType,
  AlertSeverity,
  AlertDetailsMap,
} from './types.js';
import { ALERT_THRESHOLDS, getAlertThresholds } from './config.js';
import { SUGGESTED_ACTIONS } from './types.js';
import type { HumanReviewQueue } from '../feedback/HumanReviewQueue.js';

/**
 * 评估结果输入
 */
export interface EvaluationResultInput {
  traceId: string;
  evaluationId: string;
  metrics: EvaluationResult['metrics'];
  extendedMetrics?: {
    medicalAccuracy?: MedicalAccuracyResult;
    safetyAssessment?: {
      score: number;
      severity?: 'absolute' | 'relative' | 'safe';
      contraindication?: string;
      dangerousAdvice?: string[];
    };
  };
}

/**
 * Alert broadcast function type
 */
export type AlertBroadcastFn = (event: { type: string; alert: AlertEvent }) => void;

/**
 * Alert aggregation state
 */
interface AlertAggregationState {
  count: number;
  firstAlert: AlertEvent;
  lastTimestamp: number;
}

/**
 * AlertHandler - 告警处理器
 *
 * 功能：
 * - 检测评估结果中的异常（Safety、Faithfulness、Medical Accuracy）
 * - 创建告警事件
 * - WebSocket 广播通知
 * - SQLite 存储告警历史
 * - 告警聚合和速率限制
 */
export class AlertHandler {
  private storage: TraceStorage;
  private broadcastFn?: AlertBroadcastFn;
  private aggregationMap: Map<AlertType, AlertAggregationState> = new Map();
  private recentAlerts: { timestamp: number; type: AlertType }[] = [];
  private reviewQueue?: HumanReviewQueue;
  private queryAnswerMap: Map<string, { query: string; answer: string }> = new Map();

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  /**
   * 设置广播函数
   */
  setBroadcast(fn: AlertBroadcastFn): void {
    this.broadcastFn = fn;
  }

  /**
   * 设置人工审核队列
   *
   * 任务 3.4.1: 在 AlertHandler 中集成 HumanReviewQueue
   */
  setReviewQueue(queue: HumanReviewQueue): void {
    this.reviewQueue = queue;
  }

  /**
   * 设置查询答案映射（用于创建审核项时提供上下文）
   */
  setQueryAnswer(traceId: string, query: string, answer: string): void {
    this.queryAnswerMap.set(traceId, { query, answer });
  }

  /**
   * 检查评估结果并触发告警
   *
   * 任务 2.1.3: checkAndAlert() 方法
   */
  async checkAndAlert(result: EvaluationResultInput): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];
    const thresholds = getAlertThresholds();

    // Safety 告警检查
    if (result.extendedMetrics?.safetyAssessment) {
      const safetyAlert = this.checkSafety(result, thresholds);
      if (safetyAlert) {
        alerts.push(safetyAlert);
      }
    }

    // Faithfulness 告警检查
    const faithfulnessAlert = this.checkFaithfulness(result, thresholds);
    if (faithfulnessAlert) {
      alerts.push(faithfulnessAlert);
    }

    // Medical Accuracy 告警检查
    const medicalAlert = this.checkMedicalAccuracy(result, thresholds);
    if (medicalAlert) {
      alerts.push(medicalAlert);
    }

    // Context Relevance 告警检查
    const contextAlert = this.checkContextRelevance(result, thresholds);
    if (contextAlert) {
      alerts.push(contextAlert);
    }

    // 处理所有告警
    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    return alerts;
  }

  /**
   * 检查 Safety 告警
   */
  private checkSafety(
    result: EvaluationResultInput,
    thresholds: typeof ALERT_THRESHOLDS
  ): AlertEvent | null {
    const safety = result.extendedMetrics?.safetyAssessment;
    if (!safety) return null;

    const score = safety.score;
    const delta = score - thresholds.safetyCriticalThreshold;

    // Safety critical alert
    if (score < thresholds.safetyCriticalThreshold) {
      const params: {
        traceId: string;
        evaluationId: string;
        safetyScore: number;
        threshold: number;
        delta: number;
        severity: AlertSeverity;
        contraindication?: string;
        dangerousAdvice?: string[];
      } = {
        traceId: result.traceId,
        evaluationId: result.evaluationId,
        safetyScore: score,
        threshold: thresholds.safetyCriticalThreshold,
        delta,
        severity: 'critical',
      };
      if (safety.contraindication !== undefined) {
        params.contraindication = safety.contraindication;
      }
      if (safety.dangerousAdvice !== undefined) {
        params.dangerousAdvice = safety.dangerousAdvice;
      }
      return this.createSafetyAlert(params);
    }

    // Safety warning alert
    if (score < thresholds.safetyWarningThreshold) {
      const params: {
        traceId: string;
        evaluationId: string;
        safetyScore: number;
        threshold: number;
        delta: number;
        contraindication?: string;
      } = {
        traceId: result.traceId,
        evaluationId: result.evaluationId,
        safetyScore: score,
        threshold: thresholds.safetyWarningThreshold,
        delta,
      };
      if (safety.contraindication !== undefined) {
        params.contraindication = safety.contraindication;
      }
      return this.createAttentionAlert(params);
    }

    return null;
  }

  /**
   * 创建 Safety Critical 告警
   *
   * 任务 2.1.4: createSafetyAlert() 方法
   */
  createSafetyAlert(params: {
    traceId: string;
    evaluationId: string;
    safetyScore: number;
    threshold: number;
    delta: number;
    contraindication?: string;
    dangerousAdvice?: string[];
    severity: AlertSeverity;
  }): AlertEvent {
    const alertId = this.generateAlertId('SAFETY_CRITICAL', params.traceId);

    const details: AlertDetailsMap['SAFETY_CRITICAL'] = {
      safetyScore: params.safetyScore,
      threshold: params.threshold,
      delta: params.delta,
      ...(params.contraindication && { contraindication: params.contraindication }),
      ...(params.dangerousAdvice && params.dangerousAdvice.length > 0 && { dangerousAdvice: params.dangerousAdvice }),
    };

    return {
      alertId,
      timestamp: new Date().toISOString(),
      type: 'SAFETY_CRITICAL',
      severity: params.severity,
      traceId: params.traceId,
      evaluationId: params.evaluationId,
      details,
      suggestedActions: SUGGESTED_ACTIONS['SAFETY_CRITICAL'],
      status: 'active',
    };
  }

  /**
   * 创建 Safety Attention 告警 (非 critical)
   */
  createAttentionAlert(params: {
    traceId: string;
    evaluationId: string;
    safetyScore: number;
    threshold: number;
    delta: number;
    contraindication?: string;
  }): AlertEvent {
    const alertId = this.generateAlertId('SAFETY_CRITICAL', params.traceId);

    const details: AlertDetailsMap['SAFETY_CRITICAL'] = {
      safetyScore: params.safetyScore,
      threshold: params.threshold,
      delta: params.delta,
      ...(params.contraindication && { contraindication: params.contraindication }),
    };

    return {
      alertId,
      timestamp: new Date().toISOString(),
      type: 'SAFETY_CRITICAL',
      severity: 'warning',
      traceId: params.traceId,
      evaluationId: params.evaluationId,
      details,
      suggestedActions: ['检查安全评估结果', '关注后续评估'],
      status: 'active',
    };
  }

  /**
   * 检查 Faithfulness 告警
   */
  private checkFaithfulness(
    result: EvaluationResultInput,
    thresholds: typeof ALERT_THRESHOLDS
  ): AlertEvent | null {
    const faithfulness = result.metrics.faithfulness?.score;
    if (faithfulness === undefined) return null;

    const delta = faithfulness - thresholds.faithfulnessWarningThreshold;

    if (faithfulness < thresholds.faithfulnessWarningThreshold) {
      return this.createFaithfulnessAlert({
        traceId: result.traceId,
        evaluationId: result.evaluationId,
        faithfulnessValue: faithfulness,
        threshold: thresholds.faithfulnessWarningThreshold,
        delta,
        unsupportedCount: result.metrics.faithfulness?.verdicts?.filter((v: FaithfulnessVerdict) => v.verdict === 'unsupported').length,
      });
    }

    return null;
  }

  /**
   * 创建 Faithfulness 告警
   *
   * 任务 2.1.5: createFaithfulnessAlert() 方法
   */
  createFaithfulnessAlert(params: {
    traceId: string;
    evaluationId: string;
    faithfulnessValue: number;
    threshold: number;
    delta: number;
    unsupportedCount?: number;
  }): AlertEvent {
    const alertId = this.generateAlertId('FAITHFULNESS_LOW', params.traceId);

    const details: AlertDetailsMap['FAITHFULNESS_LOW'] = {
      metric: 'faithfulness',
      value: params.faithfulnessValue,
      threshold: params.threshold,
      delta: params.delta,
      ...(params.unsupportedCount !== undefined && params.unsupportedCount > 0 && {
        unsupportedCount: params.unsupportedCount,
        hallucinationRisk: params.unsupportedCount > 3,
      }),
    };

    return {
      alertId,
      timestamp: new Date().toISOString(),
      type: 'FAITHFULNESS_LOW',
      severity: 'warning',
      traceId: params.traceId,
      evaluationId: params.evaluationId,
      details,
      suggestedActions: SUGGESTED_ACTIONS['FAITHFULNESS_LOW'],
      status: 'active',
    };
  }

  /**
   * 检查 Medical Accuracy 告警
   */
  private checkMedicalAccuracy(
    result: EvaluationResultInput,
    thresholds: typeof ALERT_THRESHOLDS
  ): AlertEvent | null {
    const medicalAccuracy = result.extendedMetrics?.medicalAccuracy?.score;
    if (medicalAccuracy === undefined) return null;

    // Medical Accuracy 告警阈值（默认 0.6）
    const medicalThreshold = 0.6;

    if (medicalAccuracy < medicalThreshold) {
      const params: {
        traceId: string;
        evaluationId: string;
        value: number;
        threshold: number;
        terminologyErrors?: string[];
        guidelineViolations?: string[];
      } = {
        traceId: result.traceId,
        evaluationId: result.evaluationId,
        value: medicalAccuracy,
        threshold: medicalThreshold,
      };
      const terminologyErrors = result.extendedMetrics?.medicalAccuracy?.terminologyErrors;
      if (terminologyErrors !== undefined) {
        params.terminologyErrors = terminologyErrors;
      }
      const guidelineViolations = result.extendedMetrics?.medicalAccuracy?.guidelineViolations;
      if (guidelineViolations !== undefined) {
        params.guidelineViolations = guidelineViolations;
      }
      return this.createMedicalAccuracyAlert(params);
    }

    return null;
  }

  /**
   * 创建 Medical Accuracy 告警
   *
   * 任务 2.1.6: createMedicalAccuracyAlert() 方法
   */
  createMedicalAccuracyAlert(params: {
    traceId: string;
    evaluationId: string;
    value: number;
    threshold: number;
    terminologyErrors?: string[];
    guidelineViolations?: string[];
  }): AlertEvent {
    const alertId = this.generateAlertId('MEDICAL_ACCURACY', params.traceId);

    const details: AlertDetailsMap['MEDICAL_ACCURACY'] = {
      metric: 'medicalAccuracy',
      value: params.value,
      ...(params.terminologyErrors && params.terminologyErrors.length > 0 && {
        terminologyErrors: params.terminologyErrors,
      }),
      ...(params.guidelineViolations && params.guidelineViolations.length > 0 && {
        guidelineViolations: params.guidelineViolations,
      }),
    };

    return {
      alertId,
      timestamp: new Date().toISOString(),
      type: 'MEDICAL_ACCURACY',
      severity: 'info',
      traceId: params.traceId,
      evaluationId: params.evaluationId,
      details,
      suggestedActions: SUGGESTED_ACTIONS['MEDICAL_ACCURACY'],
      status: 'active',
    };
  }

  /**
   * 检查 Context Relevance 告警
   */
  private checkContextRelevance(
    result: EvaluationResultInput,
    thresholds: typeof ALERT_THRESHOLDS
  ): AlertEvent | null {
    const contextRelevance = result.metrics.contextRelevance?.score;
    if (contextRelevance === undefined) return null;

    const contextThreshold = 0.4;

    if (contextRelevance < contextThreshold) {
      const chunkScores = result.metrics.contextRelevance?.chunkScores;
      const avgChunkScore = chunkScores && chunkScores.length > 0
        ? chunkScores.reduce((a: number, b: number) => a + b, 0) / chunkScores.length
        : undefined;

      const params: {
        traceId: string;
        evaluationId: string;
        value: number;
        threshold: number;
        avgChunkScore?: number;
      } = {
        traceId: result.traceId,
        evaluationId: result.evaluationId,
        value: contextRelevance,
        threshold: contextThreshold,
      };
      if (avgChunkScore !== undefined) {
        params.avgChunkScore = avgChunkScore;
      }
      return this.createContextIrrelevantAlert(params);
    }

    return null;
  }

  /**
   * 创建 Context Irrelevant 告警
   */
  createContextIrrelevantAlert(params: {
    traceId: string;
    evaluationId: string;
    value: number;
    threshold: number;
    avgChunkScore?: number;
  }): AlertEvent {
    const alertId = this.generateAlertId('CONTEXT_IRRELEVANT', params.traceId);

    const details: AlertDetailsMap['CONTEXT_IRRELEVANT'] = {
      metric: 'contextRelevance',
      value: params.value,
      threshold: params.threshold,
      ...(params.avgChunkScore !== undefined && { avgChunkScore: params.avgChunkScore }),
      suggestedTopK: 10, // 建议增加 topK
    };

    return {
      alertId,
      timestamp: new Date().toISOString(),
      type: 'CONTEXT_IRRELEVANT',
      severity: 'info',
      traceId: params.traceId,
      evaluationId: params.evaluationId,
      details,
      suggestedActions: SUGGESTED_ACTIONS['CONTEXT_IRRELEVANT'],
      status: 'active',
    };
  }

  /**
   * 处理告警（广播 + 存储）
   *
   * 任务 2.1.7: processAlert() 方法
   * 任务 3.4.2: SAFETY_CRITICAL 告警自动创建审核项
   */
  async processAlert(alert: AlertEvent): Promise<void> {
    const thresholds = getAlertThresholds();

    // 速率限制检查
    if (!this.checkRateLimit(alert.type, thresholds.alertRateLimitPerMinute)) {
      console.warn(`[AlertHandler] Rate limit exceeded for ${alert.type}, skipping broadcast`);
      // 仍然存储告警，但不广播
      await this.storage.saveAlert(alert);
      return;
    }

    // 告警聚合检查
    const aggregated = this.checkAggregation(alert, thresholds.alertAggregationWindowMs);
    if (aggregated) {
      // 已聚合，只更新计数，不广播
      await this.storage.saveAlert(alert);
      return;
    }

    // 存储告警
    await this.storage.saveAlert(alert);

    // 广播告警
    this.broadcastAlert(alert);

    // 任务 3.4.2: SAFETY_CRITICAL 告警自动创建审核项
    if (alert.type === 'SAFETY_CRITICAL' && this.reviewQueue && alert.traceId) {
      const context = this.queryAnswerMap.get(alert.traceId);
      if (context) {
        try {
          const reviewItem = await this.reviewQueue.addFromAlert(
            alert,
            context.query,
            context.answer
          );
          console.log(`[AlertHandler] Created review item for SAFETY_CRITICAL alert: ${reviewItem.reviewId}`);
        } catch (error) {
          console.error(`[AlertHandler] Failed to create review item:`, error);
        }
      }
    }

    // 记录速率限制
    this.recordAlert(alert.type);
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(type: AlertType, limit: number): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 清理过期记录
    this.recentAlerts = this.recentAlerts.filter(a => a.timestamp > oneMinuteAgo);

    // 计算最近一分钟的同类型告警数量
    const recentCount = this.recentAlerts.filter(a => a.type === type).length;

    return recentCount < limit;
  }

  /**
   * 检查告警聚合
   */
  private checkAggregation(alert: AlertEvent, windowMs: number): boolean {
    const now = Date.now();
    const existing = this.aggregationMap.get(alert.type);

    if (existing) {
      // 在聚合窗口内
      if (now - existing.lastTimestamp < windowMs) {
        existing.count++;
        existing.lastTimestamp = now;
        return true;
      }
    }

    // 创建新的聚合状态
    this.aggregationMap.set(alert.type, {
      count: 1,
      firstAlert: alert,
      lastTimestamp: now,
    });

    return false;
  }

  /**
   * 记录告警时间
   */
  private recordAlert(type: AlertType): void {
    this.recentAlerts.push({
      timestamp: Date.now(),
      type,
    });
  }

  /**
   * 广播告警
   */
  private broadcastAlert(alert: AlertEvent): void {
    if (this.broadcastFn) {
      this.broadcastFn({
        type: 'alert:new',
        alert,
      });
    }
  }

  /**
   * 生成告警 ID
   */
  private generateAlertId(type: AlertType, traceId: string): string {
    const timestamp = Date.now();
    return `alert-${type.toLowerCase()}-${traceId}-${timestamp}`;
  }

  /**
   * 获取聚合统计
   */
  getAggregationStats(): Map<AlertType, { count: number; lastTimestamp: number }> {
    const stats = new Map<AlertType, { count: number; lastTimestamp: number }>();

    for (const [type, state] of this.aggregationMap) {
      stats.set(type, {
        count: state.count,
        lastTimestamp: state.lastTimestamp,
      });
    }

    return stats;
  }

  /**
   * 清理聚合状态
   */
  clearAggregationState(): void {
    this.aggregationMap.clear();
    this.recentAlerts = [];
  }
}

/**
 * 创建 AlertHandler
 */
export function createAlertHandler(storage: TraceStorage): AlertHandler {
  return new AlertHandler(storage);
}