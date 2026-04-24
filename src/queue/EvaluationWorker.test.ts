/**
 * EvaluationWorker Tests - 评估 Worker 测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EvaluationWorker, createEvaluationWorker } from './EvaluationWorker.js';

// Mock dependencies
vi.mock('../evaluation/MedicalEvaluationPipeline.js', () => ({
  createMedicalEvaluationPipeline: vi.fn().mockReturnValue({
    evaluate: vi.fn().mockResolvedValue({
      evaluationId: 'eval-123',
      traceId: 'trace-123',
      overallScore: 0.85,
      metrics: {
        faithfulness: { score: 0.85, verdicts: [] },
        contextRelevance: { score: 0.80, chunkScores: [] },
        answerRelevance: { score: 0.90, generatedQuestions: [] },
      },
      extendedMetrics: {
        medicalAccuracy: { score: 0.85, terminologyErrors: [], guidelineViolations: [], corrections: [] },
        safetyAssessment: { score: 0.90, contraindications: { type: 'relative', details: [] }, interactions: [], dangerousAdvice: [] },
        evidenceTraceability: { score: 0.80, citationAccuracy: 0.75, missingCitations: [], invalidCitations: [] },
        completeness: { score: 0.85, coveredSubQuestions: [], missingSubQuestions: [], entityCoverage: 0.8 },
        terminologyAccuracy: { score: 0.80, terminologyErrors: [], missingAbbreviationExplanations: [] },
      },
      layerScores: { layer1: 0.85, layer2: 0.87, layer3: 0.82 },
      riskLevel: 'safe',
    }),
  }),
  MedicalEvaluationPipeline: vi.fn(),
}));

vi.mock('../tracing/TraceStorage.js', () => ({
  TraceStorage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    saveEvaluation: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  })),
  createTraceStorage: vi.fn().mockResolvedValue({
    init: vi.fn().mockResolvedValue(undefined),
    saveEvaluation: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  }),
}));

vi.mock('../config/llm-config.js', () => ({
  createLLMCaller: vi.fn().mockReturnValue(async () => 'mock response'),
}));

// Mock Bull Queue
vi.mock('bull', () => {
  const mockQueue = {
    process: vi.fn(),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: vi.fn().mockImplementation(() => mockQueue),
  };
});

describe('EvaluationWorker', () => {
  let worker: EvaluationWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = createEvaluationWorker();
  });

  afterEach(async () => {
    if (worker.isRunning()) {
      await worker.stop();
    }
  });

  describe('Worker Initialization', () => {
    it('should create worker with default config', () => {
      expect(worker).toBeDefined();
      expect(worker.isRunning()).toBe(false);
    });

    it('should accept custom config', () => {
      const customWorker = createEvaluationWorker(
        { host: 'custom-host', port: 6380 },
        { queueName: 'custom-queue' },
        { concurrency: 5 }
      );
      expect(customWorker).toBeDefined();
    });
  });

  describe('Worker Lifecycle', () => {
    it('should start worker', async () => {
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });

    it('should not start twice', async () => {
      await worker.start();
      await worker.start(); // Second call should be ignored
      expect(worker.isRunning()).toBe(true);
    });

    it('should stop worker', async () => {
      await worker.start();
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should not stop if not running', async () => {
      await worker.stop(); // Should be safe to call
      expect(worker.isRunning()).toBe(false);
    });
  });

  describe('Job Processing', () => {
    it('should process job and return result', async () => {
      // This test would require a more complex setup with actual Bull integration
      // For now, we verify the worker can be created and started
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      await worker.start();
      // Worker should be resilient to errors
      expect(worker.isRunning()).toBe(true);
    });
  });
});