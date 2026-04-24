/**
 * FeedbackAnalyzer - 反馈分析器
 *
 * 分析评估结果，生成 Adjustment 信号和 Flag
 */

import type { TraceStorage } from '../tracing/TraceStorage.js';
import type { EvaluationResult } from '../tracing/types.js';
import type { AlertEvent } from '../alert/types.js';
import type {
  Adjustment,
  AdjustmentTarget,
  FlagType,
  FeedbackSignal,
  FeedbackAnalyzerResult,
  EvaluationTrend,
  TrendDirection,
} from './types.js';
import { FLAG_TO_ALERT_MAPPING } from './types.js';

/**
 * Threshold configuration for feedback generation
 */
interface FeedbackThresholds {
  safetyCriticalThreshold: number;
  safetyAttentionThreshold: number;
  faithfulnessWarningThreshold: number;
  faithfulnessMonitorThreshold: number;
  contextRelevanceWarningThreshold: number;
  medicalAccuracyWarningThreshold: number;
  degradationThreshold: number; // Trend degradation rate threshold
}

const DEFAULT_FEEDBACK_THRESHOLDS: FeedbackThresholds = {
  safetyCriticalThreshold: 0.5,
  safetyAttentionThreshold: 0.7,
  faithfulnessWarningThreshold: 0.5,
  faithfulnessMonitorThreshold: 0.7,
  contextRelevanceWarningThreshold: 0.4,
  medicalAccuracyWarningThreshold: 0.6,
  degradationThreshold: 0.2, // 20% degradation triggers flag
};

/**
 * Evaluation history entry
 */
interface EvaluationHistoryEntry {
  traceId: string;
  evaluationId: string;
  timestamp: number;
  overallScore: number;
  faithfulness: number;
  contextRelevance: number;
  answerRelevance: number;
}

/**
 * FeedbackAnalyzer - 反馈分析器
 *
 * 任务 8.1.1: 创建 src/feedback/FeedbackAnalyzer.ts
 */
export class FeedbackAnalyzer {
  private storage: TraceStorage;
  private thresholds: FeedbackThresholds;
  private historyBuffer: EvaluationHistoryEntry[] = [];
  private bufferSize: number = 100;

  constructor(storage: TraceStorage, thresholds?: Partial<FeedbackThresholds>) {
    this.storage = storage;
    this.thresholds = { ...DEFAULT_FEEDBACK_THRESHOLDS, ...thresholds };
  }

  /**
   * 分析评估结果
   *
   * 任务 8.1.2: 实现 analyze() 方法
   */
  async analyze(
    traceId: string,
    evaluationId: string,
    metrics: EvaluationResult['metrics'],
    extendedMetrics?: {
      safetyScore?: number;
      medicalAccuracy?: number;
    }
  ): Promise<FeedbackAnalyzerResult> {
    // Generate flags
    const flags = this.generateFlags(metrics, extendedMetrics);

    // Generate adjustments
    const adjustments = this.generateAdjustments(metrics, extendedMetrics);

    // Analyze trend
    const trendAnalysis = this.analyzeTrend(metrics);

    // Build signal
    const signal: FeedbackSignal = {
      flags,
      adjustments,
      ...(trendAnalysis && { trendAnalysis }),
    };

    // Add to history buffer
    this.addToHistory(traceId, evaluationId, metrics);

    return {
      traceId,
      evaluationId,
      timestamp: Date.now(),
      signal,
    };
  }

  /**
   * 生成 Safety 反馈
   *
   * 任务 8.1.3: 实现 generateSafetyFeedback() 方法
   */
  generateSafetyFeedback(safetyScore: number, contraindication?: string): {
    flags: FlagType[];
    adjustments: Adjustment[];
  } {
    const flags: FlagType[] = [];
    const adjustments: Adjustment[] = [];

    if (safetyScore < this.thresholds.safetyCriticalThreshold) {
      flags.push('HUMAN_REVIEW_REQUIRED');

      adjustments.push({
        target: 'generation',
        change: { safetyCheckLevel: 'strict' },
        reason: `Safety score ${safetyScore} below critical threshold`,
        expiresAt: Date.now() + 3600000, // 1 hour
      });
    } else if (safetyScore < this.thresholds.safetyAttentionThreshold) {
      flags.push('ATTENTION_REQUIRED');

      adjustments.push({
        target: 'generation',
        change: { safetyCheckLevel: 'enhanced' },
        reason: `Safety score ${safetyScore} below attention threshold`,
        expiresAt: Date.now() + 3600000,
      });
    }

    return { flags, adjustments };
  }

  /**
   * 生成 Faithfulness 反馈
   *
   * 任务 8.1.4: 实现 generateFaithfulnessFeedback() 方法
   */
  generateFaithfulnessFeedback(faithfulness: number, unsupportedCount?: number): {
    flags: FlagType[];
    adjustments: Adjustment[];
  } {
    const flags: FlagType[] = [];
    const adjustments: Adjustment[] = [];

    if (faithfulness < this.thresholds.faithfulnessWarningThreshold) {
      flags.push('ATTENTION_REQUIRED');

      adjustments.push({
        target: 'retrieval',
        change: { topK: 10, rerankEnabled: true },
        reason: `Faithfulness ${faithfulness} below threshold`,
        expiresAt: Date.now() + 3600000,
      });

      if (unsupportedCount && unsupportedCount > 3) {
        adjustments.push({
          target: 'generation',
          change: { hallucinationCheck: true },
          reason: `${unsupportedCount} unsupported claims detected`,
          expiresAt: Date.now() + 3600000,
        });
      }
    }

    return { flags, adjustments };
  }

  /**
   * 生成 Context Relevance 反馈
   *
   * 任务 8.1.5: 实现 generateContextRelevanceFeedback() 方法
   */
  generateContextRelevanceFeedback(contextRelevance: number, avgChunkScore?: number): {
    flags: FlagType[];
    adjustments: Adjustment[];
  } {
    const flags: FlagType[] = [];
    const adjustments: Adjustment[] = [];

    if (contextRelevance < this.thresholds.contextRelevanceWarningThreshold) {
      adjustments.push({
        target: 'retrieval',
        change: {
          topK: 15,
          similarityThreshold: 0.3,
          ...(avgChunkScore && avgChunkScore < 0.5 && { rerankEnabled: true }),
        },
        reason: `Context relevance ${contextRelevance} below threshold`,
        expiresAt: Date.now() + 3600000,
      });
    }

    return { flags, adjustments };
  }

  /**
   * 生成 Medical Accuracy 反馈
   *
   * 任务 8.1.6: 实现 generateMedicalAccuracyFeedback() 方法
   */
  generateMedicalAccuracyFeedback(
    medicalAccuracy: number,
    terminologyErrors?: string[],
    guidelineViolations?: string[]
  ): {
    flags: FlagType[];
    adjustments: Adjustment[];
  } {
    const flags: FlagType[] = [];
    const adjustments: Adjustment[] = [];

    if (medicalAccuracy < this.thresholds.medicalAccuracyWarningThreshold) {
      flags.push('ATTENTION_REQUIRED');

      adjustments.push({
        target: 'evaluation',
        change: { terminologyCheckLevel: 'strict' },
        reason: `Medical accuracy ${medicalAccuracy} below threshold`,
        expiresAt: Date.now() + 3600000,
      });

      if (terminologyErrors && terminologyErrors.length > 0) {
        adjustments.push({
          target: 'generation',
          change: { terminologyWarning: terminologyErrors },
          reason: `Terminology errors detected: ${terminologyErrors.join(', ')}`,
          expiresAt: Date.now() + 3600000,
        });
      }
    }

    return { flags, adjustments };
  }

  /**
   * 生成 Flags
   */
  private generateFlags(
    metrics: EvaluationResult['metrics'],
    extendedMetrics?: { safetyScore?: number; medicalAccuracy?: number }
  ): FlagType[] {
    const flags: FlagType[] = [];

    // Check safety
    if (extendedMetrics?.safetyScore !== undefined) {
      const { flags: safetyFlags } = this.generateSafetyFeedback(extendedMetrics.safetyScore);
      flags.push(...safetyFlags);
    }

    // Check faithfulness
    if (metrics.faithfulness?.score !== undefined) {
      const unsupportedCount = metrics.faithfulness.verdicts?.filter(v => v.verdict === 'unsupported').length;
      const { flags: faithFlags } = this.generateFaithfulnessFeedback(
        metrics.faithfulness.score,
        unsupportedCount
      );
      flags.push(...faithFlags);
    }

    // Check medical accuracy
    if (extendedMetrics?.medicalAccuracy !== undefined) {
      const { flags: medFlags } = this.generateMedicalAccuracyFeedback(extendedMetrics.medicalAccuracy);
      flags.push(...medFlags);
    }

    // Check system degradation via trend
    const trend = this.analyzeTrend(metrics);
    if (trend && trend.trendDirection === 'degrading' && trend.degradationRate && trend.degradationRate > this.thresholds.degradationThreshold) {
      flags.push('SYSTEM_DEGRADATION');
    }

    return flags;
  }

  /**
   * 生成 Adjustments
   *
   * 任务 8.2.1-8.2.4: Adjustment 生成
   */
  private generateAdjustments(
    metrics: EvaluationResult['metrics'],
    extendedMetrics?: { safetyScore?: number; medicalAccuracy?: number }
  ): Adjustment[] {
    const adjustments: Adjustment[] = [];

    // Safety adjustments (retrieval adjustment)
    if (extendedMetrics?.safetyScore !== undefined) {
      const { adjustments: safetyAdj } = this.generateSafetyFeedback(extendedMetrics.safetyScore);
      adjustments.push(...safetyAdj);
    }

    // Faithfulness adjustments (evaluation adjustment)
    if (metrics.faithfulness?.score !== undefined) {
      const unsupportedCount = metrics.faithfulness.verdicts?.filter(v => v.verdict === 'unsupported').length;
      const { adjustments: faithAdj } = this.generateFaithfulnessFeedback(
        metrics.faithfulness.score,
        unsupportedCount
      );
      adjustments.push(...faithAdj);
    }

    // Context relevance adjustments (retrieval adjustment)
    if (metrics.contextRelevance?.score !== undefined) {
      const avgChunkScore = metrics.contextRelevance.chunkScores?.length > 0
        ? metrics.contextRelevance.chunkScores.reduce((a, b) => a + b, 0) / metrics.contextRelevance.chunkScores.length
        : undefined;
      const { adjustments: ctxAdj } = this.generateContextRelevanceFeedback(
        metrics.contextRelevance.score,
        avgChunkScore
      );
      adjustments.push(...ctxAdj);
    }

    // Medical accuracy adjustments (evaluation adjustment)
    if (extendedMetrics?.medicalAccuracy !== undefined) {
      const { adjustments: medAdj } = this.generateMedicalAccuracyFeedback(extendedMetrics.medicalAccuracy);
      adjustments.push(...medAdj);
    }

    return adjustments;
  }

  /**
   * 添加到历史缓冲区
   *
   * 任务 8.4.1: 实现 EvaluationHistoryStore 类
   */
  private addToHistory(
    traceId: string,
    evaluationId: string,
    metrics: EvaluationResult['metrics']
  ): void {
    const entry: EvaluationHistoryEntry = {
      traceId,
      evaluationId,
      timestamp: Date.now(),
      overallScore: ((metrics.faithfulness?.score ?? 0) +
        (metrics.contextRelevance?.score ?? 0) +
        (metrics.answerRelevance?.score ?? 0)) / 3,
      faithfulness: metrics.faithfulness?.score ?? 0,
      contextRelevance: metrics.contextRelevance?.score ?? 0,
      answerRelevance: metrics.answerRelevance?.score ?? 0,
    };

    this.historyBuffer.push(entry);

    if (this.historyBuffer.length > this.bufferSize) {
      this.historyBuffer.shift();
    }
  }

  /**
   * 分析趋势
   *
   * 任务 8.4.2-8.4.4: 趋势分析实现
   */
  private analyzeTrend(currentMetrics: EvaluationResult['metrics']): EvaluationTrend | undefined {
    if (this.historyBuffer.length < 10) {
      return undefined;
    }

    const currentOverall = ((currentMetrics.faithfulness?.score ?? 0) +
      (currentMetrics.contextRelevance?.score ?? 0) +
      (currentMetrics.answerRelevance?.score ?? 0)) / 3;

    // 任务 8.4.2: 实现 getRecentTrend() 方法
    const recentEntries = this.historyBuffer.slice(-10);
    const previousAverage = recentEntries.slice(0, 5).reduce((sum, e) => sum + e.overallScore, 0) / 5;
    const recentAverage = recentEntries.slice(5).reduce((sum, e) => sum + e.overallScore, 0) / 5;

    // 任务 8.4.3: 实现 degradationRate 计算
    const degradationRate = previousAverage > 0
      ? (previousAverage - recentAverage) / previousAverage
      : 0;

    // 任务 8.4.4: 实现 trendDirection 判断
    let trendDirection: TrendDirection = 'stable';
    if (degradationRate > 0.1) {
      trendDirection = 'degrading';
    } else if (degradationRate < -0.1) {
      trendDirection = 'improving';
    }

    return {
      metric: 'overall',
      currentValue: currentOverall,
      previousValue: previousAverage,
      trendDirection,
      degradationRate: Math.abs(degradationRate),
      samplesCount: recentEntries.length,
    };
  }

  /**
   * 获取历史趋势
   */
  getRecentTrend(): EvaluationTrend | undefined {
    if (this.historyBuffer.length < 10) return undefined;

    const recent = this.historyBuffer.slice(-10);
    const firstHalf = recent.slice(0, 5);
    const secondHalf = recent.slice(5);

    const firstAvg = firstHalf.reduce((s, e) => s + e.overallScore, 0) / 5;
    const secondAvg = secondHalf.reduce((s, e) => s + e.overallScore, 0) / 5;

    const degradationRate = firstAvg > 0 ? (firstAvg - secondAvg) / firstAvg : 0;
    const trendDirection = degradationRate > 0.1 ? 'degrading' : degradationRate < -0.1 ? 'improving' : 'stable';

    return {
      metric: 'overall',
      currentValue: secondAvg,
      previousValue: firstAvg,
      trendDirection,
      degradationRate: Math.abs(degradationRate),
      samplesCount: recent.length,
    };
  }
}

/**
 * 创建 FeedbackAnalyzer
 */
export function createFeedbackAnalyzer(
  storage: TraceStorage,
  thresholds?: Partial<FeedbackThresholds>
): FeedbackAnalyzer {
  return new FeedbackAnalyzer(storage, thresholds);
}