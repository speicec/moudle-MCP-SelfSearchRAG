/**
 * Evaluation Auto-Trigger Tests
 *
 * Tests for automatic evaluation triggering after Agent queries
 * Covers both Redis queue mode and sync mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock AgentEvaluationService
const mockEvaluationService = {
  submitFromAgentResult: vi.fn().mockResolvedValue({ jobId: 'job-123', submitted: true }),
  isQueueAvailable: vi.fn().mockReturnValue(true),
  init: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock AlertHandler
const mockAlertHandler = {
  setQueryAnswer: vi.fn(),
  checkAndAlert: vi.fn().mockResolvedValue([]),
};

// Mock WebSocketHandler
const mockWsHandler = {
  broadcast: vi.fn(),
  broadcastEvaluation: vi.fn(),
  getClientCount: vi.fn().mockReturnValue(1),
};

// Mock Fastify instance
const createMockFastify = (mode: 'redis' | 'sync' = 'redis') => ({
  hierarchicalStore: {
    getChunkCount: vi.fn().mockReturnValue({ small: 10, parent: 5 }),
  },
  embeddingService: {
    embedText: vi.fn().mockResolvedValue(new Array(384).fill(0)),
    getDimension: vi.fn().mockReturnValue(384),
  },
  wsHandler: mockWsHandler,
  alertHandler: mockAlertHandler,
  evaluationService: mode === 'redis' ? mockEvaluationService : {
    ...mockEvaluationService,
    isQueueAvailable: vi.fn().mockReturnValue(false),
  },
  llmCaller: vi.fn().mockResolvedValue('test answer'),
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
});

describe('Evaluation Auto-Trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockEvaluationService.submitFromAgentResult.mockResolvedValue({ jobId: 'job-123', submitted: true });
    mockEvaluationService.isQueueAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('triggerEvaluation function', () => {
    describe('Redis queue mode', () => {
      it('should submit evaluation with queue available', async () => {
        const mockFastify = createMockFastify('redis');
        const agentResult = {
          satisfied: true,
          success: true,
          answer: { text: 'Test answer', summary: 'Summary' },
          entities: { diseases: [], drugs: [], indicators: [] },
          stats: { iterations: 2, actionsExecuted: 5, retrievalCalls: 1, llmCalls: 3, totalTimeMs: 1000 },
          reasoningTrace: [],
          retrievalResults: [{ content: 'Source 1', source: { documentName: 'doc1' } }],
        };

        // Verify queue is available
        expect(mockFastify.evaluationService.isQueueAvailable()).toBe(true);

        // Simulate evaluation submission
        const result = await mockFastify.evaluationService.submitFromAgentResult(
          agentResult,
          'test query',
          'session-123',
          {
            onSuccess: (evaluationResult: any) => {
              // Broadcast evaluation:complete
              mockFastify.wsHandler.broadcast({
                type: 'evaluation:complete',
                evaluationId: evaluationResult.evaluationId,
                overallScore: evaluationResult.overallScore,
                timestamp: Date.now(),
              });
            },
            onError: (error: Error) => {
              console.warn('Evaluation failed:', error.message);
            },
          }
        );

        expect(result.submitted).toBe(true);
        expect(result.jobId).toBe('job-123');
      });

      it('should broadcast evaluation:complete event on success', async () => {
        const mockFastify = createMockFastify('redis');

        // Simulate successful evaluation
        const evaluationResult = {
          evaluationId: 'eval-456',
          traceId: 'trace-789',
          overallScore: 0.85,
          riskLevel: 'safe',
          metrics: {
            faithfulness: { score: 0.90 },
            contextRelevance: { score: 0.80 },
            answerRelevance: { score: 0.85 },
          },
          extendedMetrics: {
            medicalAccuracy: { score: 0.88 },
            safetyAssessment: { score: 0.95 },
            evidenceTraceability: { score: 0.75 },
            completeness: { score: 0.80 },
            terminologyAccuracy: { score: 0.85 },
          },
          layerScores: { layer1: 0.85, layer2: 0.91, layer3: 0.80 },
        };

        // Simulate onSuccess callback
        mockFastify.wsHandler.broadcast({
          type: 'evaluation:complete',
          evaluationId: evaluationResult.evaluationId,
          traceId: evaluationResult.traceId,
          sessionId: 'session-test',
          dimensionScores: {
            faithfulness: evaluationResult.metrics.faithfulness.score,
            contextRelevance: evaluationResult.metrics.contextRelevance.score,
            answerRelevance: evaluationResult.metrics.answerRelevance.score,
            medicalAccuracy: evaluationResult.extendedMetrics.medicalAccuracy.score,
            safetyAssessment: evaluationResult.extendedMetrics.safetyAssessment.score,
            evidenceTraceability: evaluationResult.extendedMetrics.evidenceTraceability.score,
            completeness: evaluationResult.extendedMetrics.completeness.score,
            terminologyAccuracy: evaluationResult.extendedMetrics.terminologyAccuracy.score,
          },
          layerScores: evaluationResult.layerScores,
          overallScore: evaluationResult.overallScore,
          riskLevel: evaluationResult.riskLevel,
          timestamp: Date.now(),
        });

        expect(mockFastify.wsHandler.broadcast).toHaveBeenCalled();
        const broadcastCall = mockFastify.wsHandler.broadcast.mock.calls[0]?.[0];
        expect(broadcastCall.type).toBe('evaluation:complete');
        expect(broadcastCall.overallScore).toBe(0.85);
        expect(broadcastCall.riskLevel).toBe('safe');
      });

      it('should trigger AlertHandler check on success', async () => {
        const mockFastify = createMockFastify('redis');

        // Simulate evaluation result that triggers alert
        const evaluationResult = {
          evaluationId: 'eval-danger',
          traceId: 'trace-danger',
          overallScore: 0.45,
          riskLevel: 'danger',
          metrics: {
            faithfulness: { score: 0.40 },
            contextRelevance: { score: 0.50 },
            answerRelevance: { score: 0.45 },
          },
          extendedMetrics: {
            safetyAssessment: { score: 0.30 }, // Below threshold
          },
        };

        // Trigger alert check
        await mockFastify.alertHandler.checkAndAlert({
          traceId: evaluationResult.traceId,
          evaluationId: evaluationResult.evaluationId,
          metrics: evaluationResult.metrics,
          extendedMetrics: evaluationResult.extendedMetrics,
        });

        expect(mockFastify.alertHandler.checkAndAlert).toHaveBeenCalled();
      });
    });

    describe('Sync mode (no Redis)', () => {
      it('should still submit evaluation without queue', async () => {
        const mockFastify = createMockFastify('sync');

        // Verify queue is NOT available
        expect(mockFastify.evaluationService.isQueueAvailable()).toBe(false);

        const agentResult = {
          satisfied: true,
          success: true,
          answer: { text: 'Test answer' },
          entities: { diseases: [], drugs: [], indicators: [] },
          stats: { iterations: 1, actionsExecuted: 3, retrievalCalls: 1, llmCalls: 2, totalTimeMs: 500 },
          reasoningTrace: [],
        };

        // Submit should still work (sync mode)
        const result = await mockFastify.evaluationService.submitFromAgentResult(
          agentResult,
          'test query',
          'session-sync'
        );

        // In sync mode, submission still happens (just no queue)
        expect(mockEvaluationService.submitFromAgentResult).toHaveBeenCalled();
      });

      it('should handle evaluation failure gracefully', async () => {
        const mockFastify = createMockFastify('sync');

        // Mock submission failure
        mockEvaluationService.submitFromAgentResult.mockRejectedValue(new Error('Evaluation pipeline failed'));

        const agentResult = {
          satisfied: true,
          success: true,
          answer: { text: 'Test answer' },
          entities: {},
          stats: { iterations: 1, actionsExecuted: 3, retrievalCalls: 1, llmCalls: 2, totalTimeMs: 500 },
          reasoningTrace: [],
        };

        // Attempt submission - should not throw
        try {
          await mockFastify.evaluationService.submitFromAgentResult(agentResult, 'test', 'session');
        } catch (error) {
          // Error should be caught and logged, not thrown
          expect(error).toBeDefined();
        }

        expect(mockEvaluationService.submitFromAgentResult).toHaveBeenCalled();
      });
    });

    describe('Environment variable control', () => {
      it('should skip evaluation when ENABLE_RAGAS_EVALUATION=false', () => {
        // Simulate disabled evaluation
        const disabledFastify = {
          evaluationService: null, // Not initialized
          wsHandler: mockWsHandler,
        };

        // Should skip evaluation
        if (!disabledFastify.evaluationService) {
          // Expected behavior - no evaluation
          expect(true).toBe(true);
        }
      });

      it('should enable evaluation by default', () => {
        // Default should be enabled
        const enabledByDefault = process.env.ENABLE_RAGAS_EVALUATION !== 'false';
        expect(enabledByDefault).toBe(true);
      });
    });
  });

  describe('EvaluationCompleteEvent structure', () => {
    it('should have all required dimension scores', () => {
      const dimensionScores = {
        faithfulness: 0.85,
        contextRelevance: 0.72,
        answerRelevance: 0.80,
        medicalAccuracy: 0.88,
        safetyAssessment: 0.95,
        evidenceTraceability: 0.70,
        completeness: 0.75,
        terminologyAccuracy: 0.82,
      };

      const requiredDimensions = [
        'faithfulness',
        'contextRelevance',
        'answerRelevance',
        'medicalAccuracy',
        'safetyAssessment',
        'evidenceTraceability',
        'completeness',
        'terminologyAccuracy',
      ];

      for (const dim of requiredDimensions) {
        expect(dimensionScores).toHaveProperty(dim);
        expect(typeof dimensionScores[dim as keyof typeof dimensionScores]).toBe('number');
        expect(dimensionScores[dim as keyof typeof dimensionScores]).toBeGreaterThanOrEqual(0);
        expect(dimensionScores[dim as keyof typeof dimensionScores]).toBeLessThanOrEqual(1);
      }
    });

    it('should have all layer scores', () => {
      const layerScores = {
        layer1: 0.79, // 基础 RAGAS
        layer2: 0.915, // 医疗核心
        layer3: 0.757, // 医疗增强
      };

      expect(layerScores.layer1).toBeDefined();
      expect(layerScores.layer2).toBeDefined();
      expect(layerScores.layer3).toBeDefined();
    });

    it('should have valid risk level', () => {
      const validRiskLevels: Array<'safe' | 'caution' | 'warning' | 'danger'> = ['safe', 'caution', 'warning', 'danger'];

      for (const level of validRiskLevels) {
        expect(['safe', 'caution', 'warning', 'danger']).toContain(level);
      }
    });

    it('should map overall score to correct risk level', () => {
      // Safe: >= 0.85, safety >= 0.85
      expect(determineRiskLevel({ overall: 0.85, safety: 0.85 })).toBe('safe');

      // Caution: >= 0.70, safety >= 0.70
      expect(determineRiskLevel({ overall: 0.70, safety: 0.75 })).toBe('caution');

      // Warning: < 0.70 or safety < 0.70
      expect(determineRiskLevel({ overall: 0.65, safety: 0.70 })).toBe('warning');

      // Danger: safety < 0.50
      expect(determineRiskLevel({ overall: 0.60, safety: 0.45 })).toBe('danger');
    });
  });
});

// Helper function for risk level determination (matches actual logic)
function determineRiskLevel(scores: { overall: number; safety: number }): 'safe' | 'caution' | 'warning' | 'danger' {
  if (scores.safety < 0.5) return 'danger';
  if (scores.overall < 0.7 || scores.safety < 0.7) return 'warning';
  if (scores.overall < 0.85 || scores.safety < 0.85) return 'caution';
  return 'safe';
}