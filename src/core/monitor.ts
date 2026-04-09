import type { ExecutionMetrics, StageMetrics, PipelineResult } from './harness.js';

/**
 * Execution monitor for tracking pipeline progress
 */
export class ExecutionMonitor {
  private currentDocument: string | null = null;
  private currentStage: string | null = null;
  private startTime: number = 0;
  private progress: number = 0;
  private totalStages: number = 0;

  /**
   * Start monitoring a document
   */
  startDocument(documentId: string, totalStages: number): void {
    this.currentDocument = documentId;
    this.startTime = Date.now();
    this.progress = 0;
    this.totalStages = totalStages;
    this.currentStage = null;
  }

  /**
   * Update current stage
   */
  updateStage(stageName: string): void {
    this.currentStage = stageName;
  }

  /**
   * Update progress percentage
   */
  updateProgress(completedStages: number): void {
    if (this.totalStages > 0) {
      this.progress = Math.round((completedStages / this.totalStages) * 100);
    }
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionStatus {
    const elapsedMs = this.startTime > 0 ? Date.now() - this.startTime : 0;

    return {
      documentId: this.currentDocument,
      currentStage: this.currentStage,
      progress: this.progress,
      elapsedMs,
      status: this.currentDocument ? 'running' : 'idle',
    };
  }

  /**
   * Finish monitoring
   */
  finish(): void {
    this.currentDocument = null;
    this.currentStage = null;
    this.progress = 100;
  }
}

/**
 * Execution status
 */
export interface ExecutionStatus {
  documentId: string | null;
  currentStage: string | null;
  progress: number;
  elapsedMs: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

/**
 * Metrics collector for aggregating execution data
 */
export class MetricsCollector {
  private documentMetrics: Map<string, DocumentMetrics> = new Map();
  private aggregatedMetrics: AggregatedMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageDurationMs: 0,
    minDurationMs: 0,
    maxDurationMs: 0,
    stageAggregates: new Map(),
  };

  /**
   * Record a pipeline execution result
   */
  record(result: PipelineResult): void {
    const docMetrics: DocumentMetrics = {
      documentId: result.documentId,
      status: result.status,
      durationMs: result.metrics.totalDurationMs,
      errors: result.errors.length,
      timestamp: Date.now(),
      stageMetrics: new Map(result.metrics.stageMetrics),
    };

    this.documentMetrics.set(result.documentId, docMetrics);
    this.updateAggregated(docMetrics);
  }

  /**
   * Update aggregated metrics
   */
  private updateAggregated(newMetrics: DocumentMetrics): void {
    const agg = this.aggregatedMetrics;

    agg.totalExecutions++;
    if (newMetrics.status === 'success') {
      agg.successfulExecutions++;
    } else if (newMetrics.status === 'failed') {
      agg.failedExecutions++;
    }

    // Update duration stats
    const durations = Array.from(this.documentMetrics.values())
      .map(m => m.durationMs);

    if (durations.length > 0) {
      agg.averageDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;
      agg.minDurationMs = Math.min(...durations);
      agg.maxDurationMs = Math.max(...durations);
    }

    // Update stage aggregates
    for (const [stage, metrics] of newMetrics.stageMetrics) {
      if (!agg.stageAggregates.has(stage)) {
        agg.stageAggregates.set(stage, {
          totalDurationMs: 0,
          executions: 0,
          averageDurationMs: 0,
        });
      }
      const stageAgg = agg.stageAggregates.get(stage)!;
      stageAgg.totalDurationMs += metrics.durationMs;
      stageAgg.executions++;
      stageAgg.averageDurationMs = stageAgg.totalDurationMs / stageAgg.executions;
    }
  }

  /**
   * Get metrics for a specific document
   */
  getDocumentMetrics(documentId: string): DocumentMetrics | undefined {
    return this.documentMetrics.get(documentId);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      ...this.aggregatedMetrics,
      stageAggregates: new Map(this.aggregatedMetrics.stageAggregates),
    };
  }

  /**
   * Get recent executions (last N)
   */
  getRecentExecutions(limit: number = 10): DocumentMetrics[] {
    const all = Array.from(this.documentMetrics.values());
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.documentMetrics.clear();
    this.aggregatedMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      stageAggregates: new Map(),
    };
  }
}

/**
 * Document-level metrics
 */
export interface DocumentMetrics {
  documentId: string;
  status: 'success' | 'failed' | 'partial';
  durationMs: number;
  errors: number;
  timestamp: number;
  stageMetrics: Map<string, StageMetrics>;
}

/**
 * Aggregated metrics across all executions
 */
export interface AggregatedMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  stageAggregates: Map<string, StageAggregate>;
}

/**
 * Stage-level aggregated metrics
 */
export interface StageAggregate {
  totalDurationMs: number;
  executions: number;
  averageDurationMs: number;
}

/**
 * Global monitor and collector instances
 */
export const globalMonitor = new ExecutionMonitor();
export const globalMetricsCollector = new MetricsCollector();

/**
 * Create a monitoring hook for integration with pipeline
 */
export function createMonitoringHook(monitor: ExecutionMonitor): {
  preExecution: (ctx: import('./context.js').Context) => Promise<import('./context.js').Context>;
} {
  return {
    preExecution: async (ctx) => {
      const docId = ctx.getDocumentId();
      if (docId) {
        monitor.startDocument(docId, 5); // Default 5 stages
      }
      return ctx;
    },
  };
}

/**
 * Create a metrics collection hook
 */
export function createMetricsHook(collector: MetricsCollector): {
  postExecution: (result: PipelineResult) => Promise<void>;
} {
  return {
    postExecution: async (result: PipelineResult): Promise<void> => {
      collector.record(result);
    },
  };
}