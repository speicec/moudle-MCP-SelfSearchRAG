import { create } from 'zustand';

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  totalDocumentsProcessed: number;
  averageProcessingTimeMs: number;
  totalChunksCreated: number;
  averageChunksPerDocument: number;
}

/**
 * Retrieval statistics
 */
export interface RetrievalStats {
  totalQueries: number;
  averageRetrievalTimeMs: number;
  averageResultsPerQuery: number;
  successRate: number;
}

/**
 * Chunk statistics
 */
export interface ChunkStats {
  totalSmallChunks: number;
  totalParentChunks: number;
  averageQualityScore: number;
  qualityDistribution: { high: number; medium: number; low: number };
}

/**
 * Stage time distribution
 */
export interface StageTimeDistribution {
  ingest: number;
  parse: number;
  embed: number;
  index: number;
}

/**
 * Statistics update event data from WebSocket
 */
export interface StatsUpdateEvent {
  pipelineStats: PipelineStats;
  retrievalStats: RetrievalStats;
  chunkStats: ChunkStats;
  stageTimeDistribution: StageTimeDistribution;
}

/**
 * Performance indicator
 */
export type PerformanceIndicator = 'excellent' | 'good' | 'needs_optimization';

/**
 * Stats store state
 */
export interface StatsState {
  // Statistics data
  pipelineStats: PipelineStats;
  retrievalStats: RetrievalStats;
  chunkStats: ChunkStats;
  stageTimeDistribution: StageTimeDistribution;

  // Last update timestamp
  lastUpdate: number | null;
  isLoading: boolean;
  error: string | null;

  // Performance indicators (computed)
  pipelinePerformance: PerformanceIndicator;
  retrievalPerformance: PerformanceIndicator;
  chunkQualityPerformance: PerformanceIndicator;

  // Actions
  fetchStats: () => Promise<void>;
  handleStatsUpdate: (stats: StatsUpdateEvent) => void;
  reset: () => void;
}

const defaultPipelineStats: PipelineStats = {
  totalDocumentsProcessed: 0,
  averageProcessingTimeMs: 0,
  totalChunksCreated: 0,
  averageChunksPerDocument: 0,
};

const defaultRetrievalStats: RetrievalStats = {
  totalQueries: 0,
  averageRetrievalTimeMs: 0,
  averageResultsPerQuery: 0,
  successRate: 1,
};

const defaultChunkStats: ChunkStats = {
  totalSmallChunks: 0,
  totalParentChunks: 0,
  averageQualityScore: 0,
  qualityDistribution: { high: 0, medium: 0, low: 0 },
};

const defaultStageTimeDistribution: StageTimeDistribution = {
  ingest: 0,
  parse: 0,
  embed: 0,
  index: 0,
};

/**
 * Compute performance indicator based on metrics
 */
function computePipelinePerformance(stats: PipelineStats): PerformanceIndicator {
  if (stats.totalDocumentsProcessed === 0) return 'good';
  if (stats.averageProcessingTimeMs < 5000) return 'excellent';
  if (stats.averageProcessingTimeMs < 15000) return 'good';
  return 'needs_optimization';
}

function computeRetrievalPerformance(stats: RetrievalStats): PerformanceIndicator {
  if (stats.totalQueries === 0) return 'good';
  if (stats.successRate >= 0.95 && stats.averageRetrievalTimeMs < 500) return 'excellent';
  if (stats.successRate >= 0.85 && stats.averageRetrievalTimeMs < 1000) return 'good';
  return 'needs_optimization';
}

function computeChunkQualityPerformance(stats: ChunkStats): PerformanceIndicator {
  if (stats.totalSmallChunks === 0) return 'good';
  const total = stats.qualityDistribution.high + stats.qualityDistribution.medium + stats.qualityDistribution.low;
  if (total === 0) return 'good';
  const highRatio = stats.qualityDistribution.high / total;
  if (highRatio >= 0.7) return 'excellent';
  if (highRatio >= 0.4) return 'good';
  return 'needs_optimization';
}

export const useStatsStore = create<StatsState>((set) => ({
  pipelineStats: defaultPipelineStats,
  retrievalStats: defaultRetrievalStats,
  chunkStats: defaultChunkStats,
  stageTimeDistribution: defaultStageTimeDistribution,
  lastUpdate: null,
  isLoading: false,
  error: null,
  pipelinePerformance: 'good',
  retrievalPerformance: 'good',
  chunkQualityPerformance: 'good',

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const stats: StatsUpdateEvent = await response.json();
      set({
        pipelineStats: stats.pipelineStats,
        retrievalStats: stats.retrievalStats,
        chunkStats: stats.chunkStats,
        stageTimeDistribution: stats.stageTimeDistribution,
        pipelinePerformance: computePipelinePerformance(stats.pipelineStats),
        retrievalPerformance: computeRetrievalPerformance(stats.retrievalStats),
        chunkQualityPerformance: computeChunkQualityPerformance(stats.chunkStats),
        lastUpdate: Date.now(),
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  handleStatsUpdate: (stats: StatsUpdateEvent) => {
    set({
      pipelineStats: stats.pipelineStats,
      retrievalStats: stats.retrievalStats,
      chunkStats: stats.chunkStats,
      stageTimeDistribution: stats.stageTimeDistribution,
      pipelinePerformance: computePipelinePerformance(stats.pipelineStats),
      retrievalPerformance: computeRetrievalPerformance(stats.retrievalStats),
      chunkQualityPerformance: computeChunkQualityPerformance(stats.chunkStats),
      lastUpdate: Date.now(),
    });
  },

  reset: () => {
    set({
      pipelineStats: defaultPipelineStats,
      retrievalStats: defaultRetrievalStats,
      chunkStats: defaultChunkStats,
      stageTimeDistribution: defaultStageTimeDistribution,
      lastUpdate: null,
      isLoading: false,
      error: null,
      pipelinePerformance: 'good',
      retrievalPerformance: 'good',
      chunkQualityPerformance: 'good',
    });
  },
}));