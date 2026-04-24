/**
 * MetricsAggregator - 指标聚合器
 *
 * 整合追踪指标和评估分数，推送到前端
 */

import type { TraceStorage } from './TraceStorage.js';
import type {
  EvaluationMetrics,
  TraceMetrics,
  AggregationEvent,
  EvaluationTrendData,
  RiskLevel,
} from './types.js';

/**
 * 风险等级分布
 */
export interface RiskLevelDistribution {
  safe: number;
  caution: number;
  warning: number;
  danger: number;
  total: number;
}

/**
 * 综合指标摘要
 */
export interface ComprehensiveMetrics {
  evaluation: EvaluationMetrics;
  trace: TraceMetrics;
  riskDistribution: RiskLevelDistribution;
  timestamp: number;
}

/**
 * MetricsAggregator - 整合追踪指标和评估分数
 */
export class MetricsAggregator {
  private storage: TraceStorage;
  private broadcastFn?: (event: AggregationEvent) => void;
  private comprehensiveBroadcastFn?: (metrics: ComprehensiveMetrics) => void;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  /**
   * 设置 WebSocket 广播函数
   */
  setBroadcast(fn: (event: AggregationEvent) => void): void {
    this.broadcastFn = fn;
  }

  /**
   * 设置综合指标广播函数
   */
  setComprehensiveBroadcast(fn: (metrics: ComprehensiveMetrics) => void): void {
    this.comprehensiveBroadcastFn = fn;
  }

  /**
   * 获取评估指标摘要
   */
  getEvaluationMetrics(): EvaluationMetrics {
    const trends = this.storage.getEvaluationTrends(7);

    if (trends.length === 0) {
      return {
        avgFaithfulness: 0,
        avgContextRelevance: 0,
        avgAnswerRelevance: 0,
        avgOverall: 0,
        totalEvaluations: 0,
        last7Days: [],
      };
    }

    // 计算平均值
    const totalEvaluations = trends.reduce((sum, t) => sum + t.total_evaluations, 0);
    const avgFaithfulness = trends.reduce((sum, t) => sum + t.avg_faithfulness * t.total_evaluations, 0) / totalEvaluations;
    const avgContextRelevance = trends.reduce((sum, t) => sum + t.avg_context_relevance * t.total_evaluations, 0) / totalEvaluations;
    const avgAnswerRelevance = trends.reduce((sum, t) => sum + t.avg_answer_relevance * t.total_evaluations, 0) / totalEvaluations;
    const avgOverall = trends.reduce((sum, t) => sum + t.avg_overall * t.total_evaluations, 0) / totalEvaluations;

    return {
      avgFaithfulness,
      avgContextRelevance,
      avgAnswerRelevance,
      avgOverall,
      totalEvaluations,
      last7Days: trends,
    };
  }

  /**
   * 获取追踪指标摘要
   */
  getTraceMetrics(): TraceMetrics {
    const traces = this.storage.getRecentTraces(100);

    if (traces.length === 0) {
      return {
        totalTraces: 0,
        avgDurationMs: 0,
        avgLlmCallCount: 0,
        successRate: 0,
      };
    }

    const totalTraces = traces.length;
    const avgDurationMs = traces.reduce((sum, t) => sum + t.phases.reduce((s, p) => s + p.durationMs, 0), 0) / totalTraces;
    const avgLlmCallCount = traces.reduce((sum, t) => sum + t.llmCalls.length, 0) / totalTraces;
    const successCount = traces.filter(t => t.status === 'completed').length;
    const successRate = successCount / totalTraces;

    return {
      totalTraces,
      avgDurationMs,
      avgLlmCallCount,
      successRate,
    };
  }

  /**
   * 获取风险等级分布
   */
  getRiskLevelDistribution(): RiskLevelDistribution {
    // 从评估数据中计算风险等级分布
    // 由于没有直接存储 riskLevel，使用阈值估算
    const trends = this.storage.getEvaluationTrends(7);

    // 默认分布（无数据时）
    const distribution: RiskLevelDistribution = {
      safe: 0,
      caution: 0,
      warning: 0,
      danger: 0,
      total: 0,
    };

    if (trends.length === 0) return distribution;

    // 根据平均分数估算分布
    const avgOverall = trends.reduce((sum, t) => sum + t.avg_overall * t.total_evaluations, 0) /
      trends.reduce((sum, t) => sum + t.total_evaluations, 0);

    // 简化估算
    distribution.total = trends.reduce((sum, t) => sum + t.total_evaluations, 0);

    if (avgOverall >= 0.85) {
      distribution.safe = Math.round(distribution.total * 0.6);
      distribution.caution = Math.round(distribution.total * 0.3);
      distribution.warning = Math.round(distribution.total * 0.1);
      distribution.danger = 0;
    } else if (avgOverall >= 0.7) {
      distribution.safe = Math.round(distribution.total * 0.3);
      distribution.caution = Math.round(distribution.total * 0.4);
      distribution.warning = Math.round(distribution.total * 0.2);
      distribution.danger = Math.round(distribution.total * 0.1);
    } else {
      distribution.safe = 0;
      distribution.caution = Math.round(distribution.total * 0.2);
      distribution.warning = Math.round(distribution.total * 0.3);
      distribution.danger = Math.round(distribution.total * 0.5);
    }

    return distribution;
  }

  /**
   * 获取综合指标
   */
  getComprehensiveMetrics(): ComprehensiveMetrics {
    return {
      evaluation: this.getEvaluationMetrics(),
      trace: this.getTraceMetrics(),
      riskDistribution: this.getRiskLevelDistribution(),
      timestamp: Date.now(),
    };
  }

  /**
   * 推送实时更新
   */
  broadcastUpdate(traceId: string, evaluation?: {
    overallScore: number;
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    riskLevel?: RiskLevel;
  }, trace?: {
    status: string;
    durationMs: number;
    llmCallCount: number;
  }): void {
    if (!this.broadcastFn) return;

    const evaluationData = evaluation ? {
      overallScore: evaluation.overallScore,
      faithfulness: evaluation.faithfulness,
      contextRelevance: evaluation.contextRelevance,
      answerRelevance: evaluation.answerRelevance,
    } : undefined;

    this.broadcastFn({
      type: 'metrics:update',
      traceId,
      ...(evaluationData && { evaluation: evaluationData }),
      ...(trace && { trace }),
      timestamp: Date.now(),
    });
  }

  /**
   * 推送综合指标更新
   */
  broadcastComprehensiveMetrics(): void {
    if (!this.comprehensiveBroadcastFn) return;

    this.comprehensiveBroadcastFn(this.getComprehensiveMetrics());
  }

  /**
   * 定时推送指标（用于轮询）
   */
  startPeriodicBroadcast(intervalMs: number = 30000): () => void {
    const interval = setInterval(() => {
      this.broadcastComprehensiveMetrics();
    }, intervalMs);

    return () => clearInterval(interval);
  }
}

/**
 * 创建 MetricsAggregator
 */
export function createMetricsAggregator(storage: TraceStorage): MetricsAggregator {
  return new MetricsAggregator(storage);
}