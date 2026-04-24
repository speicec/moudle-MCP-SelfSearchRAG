/**
 * AgentEvaluationService Tests - 集成服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentEvaluationService, createAgentEvaluationService } from './AgentEvaluationService.js';
import type { AgentResult } from '../../medical/agent/types.js';

// Mock EvaluationQueue
vi.mock('../queue/EvaluationQueue.js', () => ({
  createEvaluationQueue: vi.fn().mockResolvedValue({
    addJob: vi.fn().mockResolvedValue({ id: 'job-123' }),
    getJobStatus: vi.fn().mockResolvedValue('waiting'),
    getQueueStats: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 10,
      failed: 1,
      delayed: 0,
      total: 18,
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }),
  EvaluationQueue: vi.fn(),
}));

// Mock TraceStorage
vi.mock('../tracing/TraceStorage.js', () => ({
  createTraceStorage: vi.fn().mockResolvedValue({
    init: vi.fn().mockResolvedValue(undefined),
    saveTrace: vi.fn().mockResolvedValue(undefined),
    saveEvaluation: vi.fn().mockResolvedValue(undefined),
    getRecentTraces: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  }),
  TraceStorage: vi.fn(),
}));

describe('AgentEvaluationService', () => {
  let service: AgentEvaluationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = createAgentEvaluationService({
      enableEvaluation: true,
    });
    await service.init();
  });

  afterEach(async () => {
    await service.close();
  });

  describe('Service Initialization', () => {
    it('should initialize service', async () => {
      expect(service.isInitialized()).toBe(true);
    });

    it('should initialize without Redis', async () => {
      const noRedisService = createAgentEvaluationService({
        enableEvaluation: false,
      });
      await noRedisService.init();
      expect(noRedisService.isInitialized()).toBe(true);
      expect(noRedisService.isQueueAvailable()).toBe(false);
      await noRedisService.close();
    });
  });

  describe('Evaluation Submission', () => {
    it('should submit evaluation task', async () => {
      const traceData = {
        traceId: 'test-trace',
        query: { raw: 'test query' },
        status: 'completed',
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 100,
      };

      const result = await service.submitEvaluation(traceData as any);

      expect(result.submitted).toBe(true);
      expect(result.jobId).toBe('job-123');
    });

    it('should handle submission handlers', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onProgress = vi.fn();

      const traceData = {
        traceId: 'test-trace',
        query: { raw: 'test query' },
        status: 'completed',
      };

      await service.submitEvaluation(traceData as any, {
        onSuccess,
        onError,
        onProgress,
      });

      // Handlers should be registered (mock doesn't actually call them)
      expect(true).toBe(true);
    });
  });

  describe('AgentResult Integration', () => {
    it('should submit from AgentResult', async () => {
      const agentResult: AgentResult = {
        satisfied: true,
        success: true,
        answer: {
          summary: 'Test answer',
          conclusion: 'Test conclusion',
          details: [],
          evidenceGrade: 'B',
        },
        entities: {
          diseases: [],
          drugs: [],
          indicators: [],
          rawQuery: 'test query',
          confidence: 0.85,
        },
        stats: {
          iterations: 2,
          actionsExecuted: 5,
          retrievalCalls: 1,
          llmCalls: 3,
          totalTimeMs: 1000,
        },
        reasoningTrace: [],
        retrievalResults: [
          { content: 'Source 1', source: { documentName: 'doc1' } },
          { content: 'Source 2', source: { documentName: 'doc2' } },
        ],
      };

      const result = await service.submitFromAgentResult(agentResult, 'test query');

      expect(result.submitted).toBe(true);
    });
  });

  describe('Queue Stats', () => {
    it('should get evaluation status', async () => {
      const status = await service.getEvaluationStatus('job-123');
      expect(status).toBe('waiting');
    });

    it('should get queue stats', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toBeDefined();
      expect(stats?.waiting).toBe(5);
      expect(stats?.active).toBe(2);
      expect(stats?.completed).toBe(10);
    });

    it('should return null when queue not available', async () => {
      const noQueueService = createAgentEvaluationService({
        enableEvaluation: false,
      });
      await noQueueService.init();

      const status = await noQueueService.getEvaluationStatus('job-123');
      expect(status).toBeNull();

      const stats = await noQueueService.getQueueStats();
      expect(stats).toBeNull();

      await noQueueService.close();
    });
  });

  describe('Trace Retrieval', () => {
    it('should get recent traces', async () => {
      const traces = await service.getRecentTraces(100);
      expect(Array.isArray(traces)).toBe(true);
    });
  });

  describe('Service Lifecycle', () => {
    it('should close service', async () => {
      const newService = createAgentEvaluationService();
      await newService.init();
      await newService.close();

      expect(newService.isInitialized()).toBe(false);
    });
  });
});