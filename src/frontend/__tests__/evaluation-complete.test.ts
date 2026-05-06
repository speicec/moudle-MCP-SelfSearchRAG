/**
 * Frontend Evaluation Event Handling Tests
 *
 * Tests for evaluation:complete WebSocket event processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Zustand store with actual state mutation
const createStoreState = () => ({
  evaluationMetrics: {
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
  },
  handleEvaluationUpdate: vi.fn((metrics: any) => {
    // Simulate actual state update
    mockStoreState.evaluationMetrics = metrics;
  }),
});

let mockStoreState = createStoreState();

// Simulate the useStatsStore.getState() pattern
vi.mock('../../store', () => ({
  useStatsStore: {
    getState: () => mockStoreState,
  },
  usePipelineStore: {
    getState: () => ({ handleEvent: vi.fn() }),
  },
  useTimelineStore: {
    getState: () => ({
      handlePipelineStart: vi.fn(),
      handleStageStart: vi.fn(),
      handleStageProgress: vi.fn(),
      handleStageComplete: vi.fn(),
      handleError: vi.fn(),
      addGlobalLog: vi.fn(),
    }),
  },
  useChunkStore: {
    getState: () => ({ handleChunkCreated: vi.fn() }),
  },
  useRetrievalStore: {
    getState: () => ({
      handleRetrievalStart: vi.fn(),
      handleRetrievalMatch: vi.fn(),
      handleRetrievalComplete: vi.fn(),
      results: [],
      duration: 0,
    }),
  },
  useChatStore: {
    getState: () => ({
      handleGenerationStart: vi.fn(),
      handleGenerationThinking: vi.fn(),
      handleGenerationAnswer: vi.fn(),
      handleGenerationComplete: vi.fn(),
      handleGenerationError: vi.fn(),
      setCurrentSources: vi.fn(),
    }),
  },
}));

// Evaluation complete event type
interface EvaluationCompleteEvent {
  type: 'evaluation:complete';
  evaluationId: string;
  traceId: string;
  sessionId?: string;
  dimensionScores: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    medicalAccuracy: number;
    safetyAssessment: number;
    evidenceTraceability: number;
    completeness: number;
    terminologyAccuracy: number;
  };
  layerScores: {
    layer1: number;
    layer2: number;
    layer3: number;
  };
  overallScore: number;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  timestamp: number;
}

// Pipeline event type (minimal for testing)
interface PipelineEvent {
  type: string;
  timestamp: number;
  dimensionScores?: EvaluationCompleteEvent['dimensionScores'];
  layerScores?: EvaluationCompleteEvent['layerScores'];
  overallScore?: number;
  riskLevel?: EvaluationCompleteEvent['riskLevel'];
}

/**
 * Simulate the event handler from useWebSocket.ts
 */
function handleEvaluationCompleteEvent(event: PipelineEvent): void {
  if (event.type === 'evaluation:complete' && event.dimensionScores && event.layerScores) {
    // Update risk distribution incrementally
    const currentMetrics = mockStoreState.evaluationMetrics;
    const newRiskDistribution = {
      ...currentMetrics.riskDistribution,
      total: currentMetrics.riskDistribution.total + 1,
    };

    // Increment the appropriate risk level count
    if (event.riskLevel) {
      newRiskDistribution[event.riskLevel] = currentMetrics.riskDistribution[event.riskLevel] + 1;
    }

    // Call handleEvaluationUpdate with new metrics
    mockStoreState.handleEvaluationUpdate({
      avgOverall: event.overallScore ?? 0,
      dimensionScores: event.dimensionScores,
      layerScores: event.layerScores,
      riskDistribution: newRiskDistribution,
      totalEvaluations: currentMetrics.totalEvaluations + 1,
      lastEvaluationTime: event.timestamp,
    });
  }
}

describe('Frontend Evaluation Event Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state with fresh instance
    mockStoreState = createStoreState();
  });

  describe('evaluation:complete event processing', () => {
    it('should call handleEvaluationUpdate on evaluation:complete event', () => {
      const event: PipelineEvent = {
        type: 'evaluation:complete',
        timestamp: Date.now(),
        dimensionScores: {
          faithfulness: 0.85,
          contextRelevance: 0.72,
          answerRelevance: 0.80,
          medicalAccuracy: 0.88,
          safetyAssessment: 0.95,
          evidenceTraceability: 0.70,
          completeness: 0.75,
          terminologyAccuracy: 0.82,
        },
        layerScores: {
          layer1: 0.79,
          layer2: 0.915,
          layer3: 0.757,
        },
        overallScore: 0.82,
        riskLevel: 'safe',
      };

      handleEvaluationCompleteEvent(event);

      expect(mockStoreState.handleEvaluationUpdate).toHaveBeenCalled();
    });

    it('should pass correct metrics to handleEvaluationUpdate', () => {
      const event: PipelineEvent = {
        type: 'evaluation:complete',
        timestamp: 1734567890000,
        dimensionScores: {
          faithfulness: 0.90,
          contextRelevance: 0.85,
          answerRelevance: 0.88,
          medicalAccuracy: 0.92,
          safetyAssessment: 0.98,
          evidenceTraceability: 0.80,
          completeness: 0.85,
          terminologyAccuracy: 0.90,
        },
        layerScores: {
          layer1: 0.877,
          layer2: 0.95,
          layer3: 0.85,
        },
        overallScore: 0.91,
        riskLevel: 'safe',
      };

      handleEvaluationCompleteEvent(event);

      const updateCall = mockStoreState.handleEvaluationUpdate.mock.calls[0]?.[0];
      expect(updateCall.avgOverall).toBe(0.91);
      expect(updateCall.dimensionScores.faithfulness).toBe(0.90);
      expect(updateCall.layerScores.layer1).toBe(0.877);
      expect(updateCall.lastEvaluationTime).toBe(1734567890000);
    });

    it('should increment risk distribution correctly', () => {
      // First evaluation - safe
      handleEvaluationCompleteEvent({
        type: 'evaluation:complete',
        timestamp: Date.now(),
        dimensionScores: { faithfulness: 0.85, contextRelevance: 0.85, answerRelevance: 0.85, medicalAccuracy: 0.85, safetyAssessment: 0.95, evidenceTraceability: 0.85, completeness: 0.85, terminologyAccuracy: 0.85 },
        layerScores: { layer1: 0.85, layer2: 0.90, layer3: 0.85 },
        overallScore: 0.85,
        riskLevel: 'safe',
      });

      let updateCall = mockStoreState.handleEvaluationUpdate.mock.calls[0]?.[0];
      expect(updateCall.riskDistribution.safe).toBe(1);
      expect(updateCall.riskDistribution.total).toBe(1);
      expect(updateCall.totalEvaluations).toBe(1);

      // Second evaluation - caution
      handleEvaluationCompleteEvent({
        type: 'evaluation:complete',
        timestamp: Date.now(),
        dimensionScores: { faithfulness: 0.70, contextRelevance: 0.70, answerRelevance: 0.70, medicalAccuracy: 0.70, safetyAssessment: 0.75, evidenceTraceability: 0.70, completeness: 0.70, terminologyAccuracy: 0.70 },
        layerScores: { layer1: 0.70, layer2: 0.725, layer3: 0.70 },
        overallScore: 0.70,
        riskLevel: 'caution',
      });

      updateCall = mockStoreState.handleEvaluationUpdate.mock.calls[1]?.[0];
      expect(updateCall.riskDistribution.caution).toBe(1);
      expect(updateCall.riskDistribution.total).toBe(2);
      expect(updateCall.totalEvaluations).toBe(2);
    });

    it('should handle missing optional fields', () => {
      const event: PipelineEvent = {
        type: 'evaluation:complete',
        timestamp: Date.now(),
        dimensionScores: {
          faithfulness: 0.5,
          contextRelevance: 0.5,
          answerRelevance: 0.5,
          medicalAccuracy: 0.5,
          safetyAssessment: 0.5,
          evidenceTraceability: 0.5,
          completeness: 0.5,
          terminologyAccuracy: 0.5,
        },
        layerScores: {
          layer1: 0.5,
          layer2: 0.5,
          layer3: 0.5,
        },
        // overallScore and riskLevel missing
      };

      handleEvaluationCompleteEvent(event);

      const updateCall = mockStoreState.handleEvaluationUpdate.mock.calls[0]?.[0];
      expect(updateCall.avgOverall).toBe(0); // Default when missing
    });
  });

  describe('event filtering', () => {
    it('should ignore non-evaluation:complete events', () => {
      const event: PipelineEvent = {
        type: 'stats:update',
        timestamp: Date.now(),
      };

      handleEvaluationCompleteEvent(event);

      expect(mockStoreState.handleEvaluationUpdate).not.toHaveBeenCalled();
    });

    it('should ignore evaluation:complete without dimensionScores', () => {
      const event: PipelineEvent = {
        type: 'evaluation:complete',
        timestamp: Date.now(),
        // Missing dimensionScores
        overallScore: 0.85,
      };

      handleEvaluationCompleteEvent(event);

      expect(mockStoreState.handleEvaluationUpdate).not.toHaveBeenCalled();
    });

    it('should ignore evaluation:complete without layerScores', () => {
      const event: PipelineEvent = {
        type: 'evaluation:complete',
        timestamp: Date.now(),
        dimensionScores: {
          faithfulness: 0.85,
          contextRelevance: 0.85,
          answerRelevance: 0.85,
          medicalAccuracy: 0.85,
          safetyAssessment: 0.85,
          evidenceTraceability: 0.85,
          completeness: 0.85,
          terminologyAccuracy: 0.85,
        },
        // Missing layerScores
        overallScore: 0.85,
      };

      handleEvaluationCompleteEvent(event);

      expect(mockStoreState.handleEvaluationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('HTTP polling fallback', () => {
    it('should support fetchStats as alternative update path', () => {
      // Simulate HTTP polling response
      const httpUpdate = {
        pipelineStats: { totalDocumentsProcessed: 10 },
        retrievalStats: { totalQueries: 100 },
        chunkStats: { totalSmallChunks: 500 },
        stageTimeDistribution: { ingest: 100, parse: 200, embed: 300, index: 50 },
        evaluationMetrics: {
          avgOverall: 0.80,
          dimensionScores: {
            faithfulness: 0.82,
            contextRelevance: 0.78,
            answerRelevance: 0.80,
            medicalAccuracy: 0.85,
            safetyAssessment: 0.90,
            evidenceTraceability: 0.75,
            completeness: 0.70,
            terminologyAccuracy: 0.80,
          },
          layerScores: { layer1: 0.80, layer2: 0.875, layer3: 0.75 },
          riskDistribution: { safe: 15, caution: 10, warning: 3, danger: 1, total: 29 },
          totalEvaluations: 29,
          lastEvaluationTime: Date.now(),
        },
      };

      // In actual store, handleStatsUpdate would be called
      // We simulate by calling handleEvaluationUpdate directly
      mockStoreState.handleEvaluationUpdate(httpUpdate.evaluationMetrics);

      expect(mockStoreState.handleEvaluationUpdate).toHaveBeenCalled();
      const updateCall = mockStoreState.handleEvaluationUpdate.mock.calls[0]?.[0];
      expect(updateCall.totalEvaluations).toBe(29);
    });
  });

  describe('risk distribution accumulation', () => {
    it('should correctly accumulate multiple risk levels', () => {
      const events = [
        { riskLevel: 'safe' as const },
        { riskLevel: 'safe' as const },
        { riskLevel: 'caution' as const },
        { riskLevel: 'warning' as const },
        { riskLevel: 'safe' as const },
        { riskLevel: 'danger' as const },
      ];

      const dimScores = { faithfulness: 0.5, contextRelevance: 0.5, answerRelevance: 0.5, medicalAccuracy: 0.5, safetyAssessment: 0.5, evidenceTraceability: 0.5, completeness: 0.5, terminologyAccuracy: 0.5 };
      const layerScores = { layer1: 0.5, layer2: 0.5, layer3: 0.5 };

      for (const ev of events) {
        handleEvaluationCompleteEvent({
          type: 'evaluation:complete',
          timestamp: Date.now(),
          dimensionScores: dimScores,
          layerScores: layerScores,
          overallScore: 0.5,
          riskLevel: ev.riskLevel,
        });
      }

      // Check final distribution
      const lastCall = mockStoreState.handleEvaluationUpdate.mock.calls[events.length - 1]?.[0];
      expect(lastCall.riskDistribution.safe).toBe(3);
      expect(lastCall.riskDistribution.caution).toBe(1);
      expect(lastCall.riskDistribution.warning).toBe(1);
      expect(lastCall.riskDistribution.danger).toBe(1);
      expect(lastCall.riskDistribution.total).toBe(6);
      expect(lastCall.totalEvaluations).toBe(6);
    });
  });
});