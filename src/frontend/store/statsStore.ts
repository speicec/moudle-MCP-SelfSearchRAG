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
 * Evaluation dimension scores (8 dimensions)
 */
export interface EvaluationDimensionScores {
  faithfulness: number;
  contextRelevance: number;
  answerRelevance: number;
  medicalAccuracy: number;
  safetyAssessment: number;
  evidenceTraceability: number;
  completeness: number;
  terminologyAccuracy: number;
}

/**
 * Layer scores (3 layers)
 */
export interface LayerScores {
  layer1: number; // 基础 RAGAS
  layer2: number; // 医疗核心
  layer3: number; // 医疗增强
}

/**
 * Risk level distribution
 */
export interface RiskLevelDistribution {
  safe: number;
  caution: number;
  warning: number;
  danger: number;
  total: number;
}

/**
 * Evaluation metrics (新增)
 */
export interface EvaluationMetrics {
  avgOverall: number;
  dimensionScores: EvaluationDimensionScores;
  layerScores: LayerScores;
  riskDistribution: RiskLevelDistribution;
  totalEvaluations: number;
  lastEvaluationTime: number | null;
}

/**
 * Statistics update event data from WebSocket
 */
export interface StatsUpdateEvent {
  pipelineStats: PipelineStats;
  retrievalStats: RetrievalStats;
  chunkStats: ChunkStats;
  stageTimeDistribution: StageTimeDistribution;
  evaluationMetrics?: EvaluationMetrics;
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
  evaluationMetrics: EvaluationMetrics; // 新增

  // Last update timestamp
  lastUpdate: number | null;
  isLoading: boolean;
  error: string | null;

  // Performance indicators (computed)
  pipelinePerformance: PerformanceIndicator;
  retrievalPerformance: PerformanceIndicator;
  chunkQualityPerformance: PerformanceIndicator;
  evaluationPerformance: PerformanceIndicator; // 新增

  // Actions
  fetchStats: () => Promise<void>;
  handleStatsUpdate: (stats: StatsUpdateEvent) => void;
  handleEvaluationUpdate: (metrics: EvaluationMetrics) => void; // 新增
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

const defaultEvaluationMetrics: EvaluationMetrics = {
  avgOverall: 0,
  dimensionScores: {
    faithfulness: 0,
    contextRelevance: 0,
    answerRelevance: 0,
    medicalAccuracy: 0,
    safetyAssessment: 0,
    evidenceTraceability: 0,
    completeness: 0,
    terminologyAccuracy: 0,
  },
  layerScores: {
    layer1: 0,
    layer2: 0,
    layer3: 0,
  },
  riskDistribution: {
    safe: 0,
    caution: 0,
    warning: 0,
    danger: 0,
    total: 0,
  },
  totalEvaluations: 0,
  lastEvaluationTime: null,
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

function computeEvaluationPerformance(metrics: EvaluationMetrics): PerformanceIndicator {
  if (metrics.totalEvaluations === 0) return 'good';
  if (metrics.avgOverall >= 0.85) return 'excellent';
  if (metrics.avgOverall >= 0.70) return 'good';
  return 'needs_optimization';
}

export const useStatsStore = create<StatsState>((set) => ({
  pipelineStats: defaultPipelineStats,
  retrievalStats: defaultRetrievalStats,
  chunkStats: defaultChunkStats,
  stageTimeDistribution: defaultStageTimeDistribution,
  evaluationMetrics: defaultEvaluationMetrics,
  lastUpdate: null,
  isLoading: false,
  error: null,
  pipelinePerformance: 'good',
  retrievalPerformance: 'good',
  chunkQualityPerformance: 'good',
  evaluationPerformance: 'good',

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
        evaluationMetrics: stats.evaluationMetrics ?? defaultEvaluationMetrics,
        pipelinePerformance: computePipelinePerformance(stats.pipelineStats),
        retrievalPerformance: computeRetrievalPerformance(stats.retrievalStats),
        chunkQualityPerformance: computeChunkQualityPerformance(stats.chunkStats),
        evaluationPerformance: stats.evaluationMetrics ? computeEvaluationPerformance(stats.evaluationMetrics) : 'good',
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
      evaluationMetrics: stats.evaluationMetrics ?? defaultEvaluationMetrics,
      pipelinePerformance: computePipelinePerformance(stats.pipelineStats),
      retrievalPerformance: computeRetrievalPerformance(stats.retrievalStats),
      chunkQualityPerformance: computeChunkQualityPerformance(stats.chunkStats),
      evaluationPerformance: stats.evaluationMetrics ? computeEvaluationPerformance(stats.evaluationMetrics) : 'good',
      lastUpdate: Date.now(),
    });
  },

  handleEvaluationUpdate: (metrics: EvaluationMetrics) => {
    set({
      evaluationMetrics: metrics,
      evaluationPerformance: computeEvaluationPerformance(metrics),
      lastUpdate: Date.now(),
    });
  },

  reset: () => {
    set({
      pipelineStats: defaultPipelineStats,
      retrievalStats: defaultRetrievalStats,
      chunkStats: defaultChunkStats,
      stageTimeDistribution: defaultStageTimeDistribution,
      evaluationMetrics: defaultEvaluationMetrics,
      lastUpdate: null,
      isLoading: false,
      error: null,
      pipelinePerformance: 'good',
      retrievalPerformance: 'good',
      chunkQualityPerformance: 'good',
      evaluationPerformance: 'good',
    });
  },
}));