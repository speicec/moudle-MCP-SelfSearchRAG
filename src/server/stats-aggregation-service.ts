import type { FastifyInstance } from 'fastify';
import type { StatsUpdateData } from '../server/types.js';
import { PipelineEmitter } from '../server/pipeline-emitter.js';
import type { HierarchicalStore } from '../chunking/hierarchical-store.js';

/**
 * Statistics aggregation service
 * Collects and broadcasts system statistics periodically
 */
export class StatsAggregationService {
  private fastify: FastifyInstance;
  private hierarchicalStore: HierarchicalStore;
  private intervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private emitter: PipelineEmitter | null = null;

  // Track retrieval statistics
  private retrievalStats = {
    totalQueries: 0,
    totalRetrievalTimeMs: 0,
    totalResults: 0,
    failedQueries: 0,
  };

  // Track pipeline statistics
  private pipelineStats = {
    totalDocumentsProcessed: 0,
    totalProcessingTimeMs: 0,
    totalChunksCreated: 0,
    stageTimes: {
      ingest: 0,
      parse: 0,
      embed: 0,
      index: 0,
    },
  };

  constructor(
    fastify: FastifyInstance,
    hierarchicalStore: HierarchicalStore,
    intervalMs: number = 5000 // Default: emit every 5 seconds
  ) {
    this.fastify = fastify;
    this.hierarchicalStore = hierarchicalStore;
    this.intervalMs = intervalMs;
  }

  /**
   * Start periodic stats emission
   */
  start(): void {
    if (this.intervalId) return;

    const wsHandler = this.fastify.wsHandler;
    if (wsHandler) {
      this.emitter = new PipelineEmitter('stats', wsHandler);
    }

    this.intervalId = setInterval(() => {
      this.emitStats();
    }, this.intervalMs);

    this.fastify.log.info('[StatsAggregationService] Started with interval %dms', this.intervalMs);
  }

  /**
   * Stop periodic stats emission
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.fastify.log.info('[StatsAggregationService] Stopped');
  }

  /**
   * Record a retrieval query
   */
  recordRetrieval(durationMs: number, resultsCount: number, success: boolean): void {
    this.retrievalStats.totalQueries++;
    this.retrievalStats.totalRetrievalTimeMs += durationMs;
    this.retrievalStats.totalResults += resultsCount;
    if (!success) {
      this.retrievalStats.failedQueries++;
    }
  }

  /**
   * Record pipeline processing
   */
  recordPipelineProcessing(
    durationMs: number,
    chunksCreated: number,
    stageTimes?: { ingest?: number; parse?: number; embed?: number; index?: number }
  ): void {
    this.pipelineStats.totalDocumentsProcessed++;
    this.pipelineStats.totalProcessingTimeMs += durationMs;
    this.pipelineStats.totalChunksCreated += chunksCreated;

    if (stageTimes) {
      this.pipelineStats.stageTimes.ingest += stageTimes.ingest ?? 0;
      this.pipelineStats.stageTimes.parse += stageTimes.parse ?? 0;
      this.pipelineStats.stageTimes.embed += stageTimes.embed ?? 0;
      this.pipelineStats.stageTimes.index += stageTimes.index ?? 0;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): StatsUpdateData {
    const chunkCount = this.hierarchicalStore.getChunkCount();
    const smallChunks = this.hierarchicalStore.getAllSmallChunks();
    const parentChunks = this.hierarchicalStore.getAllParentChunks();

    // Calculate quality distribution
    const qualityDistribution = this.calculateQualityDistribution(smallChunks);

    // Calculate averages
    const avgQualityScore = smallChunks.length > 0
      ? smallChunks.reduce((sum, c) => sum + c.qualityScore.composite, 0) / smallChunks.length
      : 0;

    return {
      pipelineStats: {
        totalDocumentsProcessed: this.pipelineStats.totalDocumentsProcessed,
        averageProcessingTimeMs: this.pipelineStats.totalDocumentsProcessed > 0
          ? this.pipelineStats.totalProcessingTimeMs / this.pipelineStats.totalDocumentsProcessed
          : 0,
        totalChunksCreated: this.pipelineStats.totalChunksCreated,
        averageChunksPerDocument: this.pipelineStats.totalDocumentsProcessed > 0
          ? this.pipelineStats.totalChunksCreated / this.pipelineStats.totalDocumentsProcessed
          : 0,
      },
      retrievalStats: {
        totalQueries: this.retrievalStats.totalQueries,
        averageRetrievalTimeMs: this.retrievalStats.totalQueries > 0
          ? this.retrievalStats.totalRetrievalTimeMs / this.retrievalStats.totalQueries
          : 0,
        averageResultsPerQuery: this.retrievalStats.totalQueries > 0
          ? this.retrievalStats.totalResults / this.retrievalStats.totalQueries
          : 0,
        successRate: this.retrievalStats.totalQueries > 0
          ? (this.retrievalStats.totalQueries - this.retrievalStats.failedQueries) / this.retrievalStats.totalQueries
          : 1,
      },
      chunkStats: {
        totalSmallChunks: chunkCount.small,
        totalParentChunks: chunkCount.parent,
        averageQualityScore: avgQualityScore,
        qualityDistribution,
      },
      stageTimeDistribution: {
        ingest: this.pipelineStats.stageTimes.ingest,
        parse: this.pipelineStats.stageTimes.parse,
        embed: this.pipelineStats.stageTimes.embed,
        index: this.pipelineStats.stageTimes.index,
      },
    };
  }

  /**
   * Calculate quality distribution (high/medium/low)
   */
  private calculateQualityDistribution(chunks: Array<{ qualityScore: { composite: number } }>): {
    high: number;
    medium: number;
    low: number;
  } {
    const high = chunks.filter(c => c.qualityScore.composite >= 0.8).length;
    const medium = chunks.filter(c => c.qualityScore.composite >= 0.5 && c.qualityScore.composite < 0.8).length;
    const low = chunks.filter(c => c.qualityScore.composite < 0.5).length;

    return { high, medium, low };
  }

  /**
   * Emit stats:update event
   */
  private emitStats(): void {
    if (!this.emitter) return;

    const stats = this.getStats();
    this.emitter.emitStatsUpdate(stats);
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.retrievalStats = {
      totalQueries: 0,
      totalRetrievalTimeMs: 0,
      totalResults: 0,
      failedQueries: 0,
    };
    this.pipelineStats = {
      totalDocumentsProcessed: 0,
      totalProcessingTimeMs: 0,
      totalChunksCreated: 0,
      stageTimes: {
        ingest: 0,
        parse: 0,
        embed: 0,
        index: 0,
      },
    };
  }
}

/**
 * Create stats aggregation service
 */
export function createStatsAggregationService(
  fastify: FastifyInstance,
  hierarchicalStore: HierarchicalStore,
  intervalMs?: number
): StatsAggregationService {
  return new StatsAggregationService(fastify, hierarchicalStore, intervalMs);
}