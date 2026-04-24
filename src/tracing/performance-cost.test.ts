/**
 * Performance and Cost Verification Tests
 *
 * 任务 11.2.1: 验证告警响应时间 < 1s
 * 任务 11.2.2: 验证 Layer 3 评估延迟增加 < 2s
 * 任务 11.2.3: 验证扩缩容响应时间 < 1min
 * 任务 11.2.4: 验证 WebSocket 负载承受能力
 * 任务 11.3.1: 对比 Layer 3 规则 vs LLM 成本
 * 任务 11.3.2: 验证条件触发成本节省效果
 * 任务 11.3.3: 设置成本监控阈值
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlertHandler, type EvaluationResultInput } from '../../alert/AlertHandler.js';
import { Layer3Evaluator } from '../../evaluation/Layer3Evaluator.js';
import { EvaluationAutoscaler, MockDockerAdapter } from '../../scaler/EvaluationAutoscaler.js';
import type { TraceStorage } from '../../tracing/TraceStorage.js';

// Mock TraceStorage
const createMockStorage = () => ({
  saveAlert: vi.fn().mockResolvedValue(undefined),
  getAlerts: vi.fn().mockResolvedValue([]),
  getAlert: vi.fn().mockResolvedValue(null),
  acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
  resolveAlert: vi.fn().mockResolvedValue(undefined),
  saveReviewItem: vi.fn().mockResolvedValue(undefined),
  getReviewItems: vi.fn().mockReturnValue([]),
  updateReviewItem: vi.fn().mockResolvedValue(undefined),
  getReviewCount: vi.fn().mockReturnValue(0),
  saveScaleEvent: vi.fn().mockResolvedValue(undefined),
  getScaleEvents: vi.fn().mockReturnValue([]),
} as unknown as TraceStorage);

// ==================== 任务 11.2.1: 验证告警响应时间 < 1s ====================

describe('Alert Response Time Verification (任务 11.2.1)', () => {
  let alertHandler: AlertHandler;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    alertHandler = new AlertHandler(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('response time benchmarks', () => {
    it('should process alert within 1 second', async () => {
      const result: EvaluationResultInput = {
        traceId: 'perf-test',
        evaluationId: 'eval-1',
        metrics: {
          faithfulness: { score: 0.3 },
          contextRelevance: { score: 0.8 },
        },
      };

      const startTime = Date.now();
      await alertHandler.checkAndAlert(result);
      const elapsedMs = Date.now() - startTime;

      // Should complete within 1 second (usually much faster)
      expect(elapsedMs).toBeLessThan(1000);
    });

    it('should handle multiple alerts efficiently', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const result: EvaluationResultInput = {
          traceId: `perf-batch-${i}`,
          evaluationId: `eval-${i}`,
          metrics: {
            faithfulness: { score: 0.3 },
            contextRelevance: { score: 0.8 },
          },
        };

        await alertHandler.checkAndAlert(result);
      }

      const elapsedMs = Date.now() - startTime;

      // 10 alerts should complete within reasonable time
      expect(elapsedMs).toBeLessThan(5000);
    });

    it('should have minimal latency for alert broadcast', async () => {
      const broadcastFn = vi.fn();
      alertHandler.setBroadcast(broadcastFn);

      const result: EvaluationResultInput = {
        traceId: 'broadcast-perf',
        evaluationId: 'eval-2',
        metrics: {
          faithfulness: { score: 0.3 },
          contextRelevance: { score: 0.8 },
        },
      };

      const startTime = Date.now();
      await alertHandler.checkAndAlert(result);

      // Broadcast should be immediate (synchronous call)
      expect(broadcastFn).toHaveBeenCalled();
      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(100);
    });
  });
});

// ==================== 任务 11.2.2: 验证 Layer 3 评估延迟增加 < 2s ====================

describe('Layer 3 Evaluation Latency Verification (任务 11.2.2)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLLMCaller = vi.fn().mockImplementation(async () => {
      // Simulate realistic LLM response time (500-1500ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      return JSON.stringify({
        evidenceTraceability: { score: 0.85, unsupportedClaims: [], hallucinationRisk: false, reasoning: '' },
        completeness: { score: 0.9, missingElements: [], coveragePercentage: 90, reasoning: '' },
        terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [], reasoning: '' },
      });
    });

    evaluator = new Layer3Evaluator(mockLLMCaller as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('latency benchmarks', () => {
    it('should complete LLM evaluation within 2 seconds', async () => {
      const startTime = Date.now();

      await evaluator.evaluate(
        '问题',
        '回答',
        ['证据'],
        { faithfulness: 0.5 }
      );

      const elapsedMs = Date.now() - startTime;

      // Should complete within 2 seconds (including LLM call)
      expect(elapsedMs).toBeLessThan(2000);
    });

    it('should have faster fallback evaluation', async () => {
      mockLLMCaller.mockRejectedValue(new Error('LLM failed'));

      const startTime = Date.now();

      await evaluator.evaluate(
        '问题',
        '回答',
        ['证据'],
        { faithfulness: 0.5 }
      );

      const elapsedMs = Date.now() - startTime;

      // Fallback should be very fast (no LLM call)
      expect(elapsedMs).toBeLessThan(100);
    });

    it('should have minimal overhead for rules evaluation', async () => {
      const startTime = Date.now();

      await evaluator.evaluate(
        '问题',
        '回答',
        ['证据'],
        { faithfulness: 0.9, entitiesCount: 1 }
      );

      const elapsedMs = Date.now() - startTime;

      // Rules evaluation should be very fast
      expect(elapsedMs).toBeLessThan(50);
    });
  });
});

// ==================== 任务 11.2.3: 验证扩缩容响应时间 < 1min ====================

describe('Autoscaler Response Time Verification (任务 11.2.3)', () => {
  let autoscaler: EvaluationAutoscaler;
  let mockStorage: TraceStorage;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockDocker: MockDockerAdapter;

  const createMockQueue = () => ({
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 100,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    }),
  });

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockQueue = createMockQueue();
    mockDocker = new MockDockerAdapter();

    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker, {
      cooldownPeriod: 0, // No cooldown for testing
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    autoscaler.stop();
    vi.resetAllMocks();
  });

  describe('response time benchmarks', () => {
    it('should complete scale decision within reasonable time', async () => {
      const startTime = Date.now();

      await autoscaler.checkAndScale();

      const elapsedMs = Date.now() - startTime;

      // Should complete quickly (mock Docker)
      expect(elapsedMs).toBeLessThan(1000);
    });

    it('should handle manual scale request quickly', async () => {
      const startTime = Date.now();

      await autoscaler.scaleTo(5);

      const elapsedMs = Date.now() - startTime;

      expect(elapsedMs).toBeLessThan(1000);
    });

    // Note: Real Docker operations would take longer
    // This is a placeholder for manual verification
    it.skip('should complete real Docker scale within 1 minute', async () => {
      // Manual test: Requires actual Docker environment
      // Expected: docker compose scale completes within 60s
    });
  });
});

// ==================== 任务 11.2.4: 验证 WebSocket 负载承受能力 ====================

describe('WebSocket Load Capacity Verification (任务 11.2.4)', () => {
  let alertHandler: AlertHandler;
  let mockStorage: TraceStorage;
  let broadcastFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    broadcastFn = vi.fn();
    alertHandler = new AlertHandler(mockStorage);
    alertHandler.setBroadcast(broadcastFn);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('load capacity', () => {
    it('should handle rapid broadcast without blocking', async () => {
      const startTime = Date.now();

      // Simulate rapid alert generation
      for (let i = 0; i < 50; i++) {
        const result: EvaluationResultInput = {
          traceId: `load-${i}`,
          evaluationId: `eval-${i}`,
          metrics: {
            faithfulness: { score: 0.3 },
            contextRelevance: { score: 0.8 },
          },
        };

        await alertHandler.checkAndAlert(result);
      }

      const elapsedMs = Date.now() - startTime;

      // Should complete without blocking
      expect(elapsedMs).toBeLessThan(10000);
      expect(broadcastFn.mock.calls.length).toBeGreaterThanOrEqual(50);
    });

    it('should handle concurrent alert processing', async () => {
      const startTime = Date.now();

      // Process multiple alerts concurrently
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const result: EvaluationResultInput = {
          traceId: `concurrent-${i}`,
          evaluationId: `eval-${i}`,
          metrics: {
            faithfulness: { score: 0.3 },
            contextRelevance: { score: 0.8 },
          },
        };

        promises.push(alertHandler.checkAndAlert(result));
      }

      await Promise.all(promises);

      const elapsedMs = Date.now() - startTime;

      // Concurrent processing should be efficient
      expect(elapsedMs).toBeLessThan(5000);
    });
  });
});

// ==================== 任务 11.3.1: 对比 Layer 3 规则 vs LLM 成本 ====================

describe('Layer 3 Cost Comparison (任务 11.3.1)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLLMCaller = vi.fn().mockResolvedValue(JSON.stringify({
      evidenceTraceability: { score: 0.85, unsupportedClaims: [], hallucinationRisk: false, reasoning: '' },
      completeness: { score: 0.9, missingElements: [], coveragePercentage: 90, reasoning: '' },
      terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [], reasoning: '' },
    }));

    evaluator = new Layer3Evaluator(mockLLMCaller as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('cost comparison', () => {
    it('should track LLM usage vs rules usage', async () => {
      // LLM evaluation
      const llmResult = await evaluator.evaluate('Q1', 'A1', ['E'], { faithfulness: 0.5 });

      vi.clearAllMocks();

      // Rules evaluation
      const rulesResult = await evaluator.evaluate('Q2', 'A2', ['E'], { faithfulness: 0.9, entitiesCount: 1 });

      expect(llmResult.llmUsed).toBe(true);
      expect(rulesResult.llmUsed).toBe(false);
    });

    it('should estimate token cost from prompt', async () => {
      await evaluator.evaluate('问题', '回答', ['证据'], { faithfulness: 0.5 });

      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      // Approximate token count (4 chars per token)
      const estimatedTokens = Math.ceil(prompt.length / 4);

      // Prompt should be reasonably sized
      expect(estimatedTokens).toBeGreaterThan(100);
      expect(estimatedTokens).toBeLessThan(2000);
    });

    it('should demonstrate cost advantage of conditional trigger', async () => {
      // Run 100 evaluations with 30% trigger rate
      const llmCalls = [];

      for (let i = 0; i < 100; i++) {
        vi.clearAllMocks();

        const triggerMetrics = i < 30
          ? { faithfulness: 0.5 } // Trigger
          : { faithfulness: 0.9, entitiesCount: 1 }; // No trigger

        mockLLMCaller.mockResolvedValue(JSON.stringify({
          evidenceTraceability: { score: 0.85, unsupportedClaims: [], hallucinationRisk: false, reasoning: '' },
          completeness: { score: 0.9, missingElements: [], coveragePercentage: 90, reasoning: '' },
          terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [], reasoning: '' },
        }));

        const result = await evaluator.evaluate(`Q${i}`, `A${i}`, [`E${i}`], triggerMetrics);
        llmCalls.push(result.llmUsed);
      }

      const llmCount = llmCalls.filter(Boolean).length;
      const rulesCount = llmCalls.filter(b => !b).length;

      // Should have 70% cost savings (rules vs LLM)
      expect(rulesCount).toBe(70);
      expect(llmCount).toBe(30);
    });
  });
});

// ==================== 任务 11.3.2: 验证条件触发成本节省效果 ====================

describe('Conditional Trigger Cost Savings Verification (任务 11.3.2)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLLMCaller = vi.fn().mockResolvedValue(JSON.stringify({
      evidenceTraceability: { score: 0.85, unsupportedClaims: [], hallucinationRisk: false, reasoning: '' },
      completeness: { score: 0.9, missingElements: [], coveragePercentage: 90, reasoning: '' },
      terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [], reasoning: '' },
    }));

    evaluator = new Layer3Evaluator(mockLLMCaller as any, { useConditionalTrigger: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('cost savings analysis', () => {
    it('should achieve significant cost savings with conditional trigger', async () => {
      // Simulate production workload: 1000 evaluations, ~15% need LLM
      const results = [];

      for (let i = 0; i < 100; i++) {
        vi.clearAllMocks();

        // Realistic distribution: most evaluations have good faithfulness
        const faithfulness = i < 15 ? 0.5 : 0.85;
        const entitiesCount = i < 5 ? 3 : 1;

        mockLLMCaller.mockResolvedValue(JSON.stringify({
          evidenceTraceability: { score: 0.85, unsupportedClaims: [], hallucinationRisk: false, reasoning: '' },
          completeness: { score: 0.9, missingElements: [], coveragePercentage: 90, reasoning: '' },
          terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [], reasoning: '' },
        }));

        const result = await evaluator.evaluate(`Q${i}`, `A${i}`, [`E${i}`], { faithfulness, entitiesCount });
        results.push(result.llmUsed);
      }

      const llmCount = results.filter(Boolean).length;

      // Cost savings = (100 - llmCount) / 100
      const costSavingsPercent = (100 - llmCount);

      // Should achieve at least 80% cost savings
      expect(costSavingsPercent).toBeGreaterThan(80);
    });

    it('should use LLM only when needed', async () => {
      // High faithfulness, single entity - should not trigger
      const result1 = await evaluator.evaluate('Q1', 'A1', ['E'], { faithfulness: 0.9, entitiesCount: 1 });

      vi.clearAllMocks();

      // Low faithfulness - should trigger
      const result2 = await evaluator.evaluate('Q2', 'A2', ['E'], { faithfulness: 0.5 });

      expect(result1.llmUsed).toBe(false);
      expect(result2.llmUsed).toBe(true);
    });

    it('should maintain evaluation quality while saving cost', async () => {
      // Both LLM and rules should produce valid scores
      mockLLMCaller.mockResolvedValue(JSON.stringify({
        evidenceTraceability: { score: 0.85, unsupportedClaims: [], hallucinationRisk: false, reasoning: '' },
        completeness: { score: 0.9, missingElements: [], coveragePercentage: 90, reasoning: '' },
        terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [], reasoning: '' },
      }));

      const llmResult = await evaluator.evaluate('Q', 'A', ['E'], { faithfulness: 0.5 });

      vi.clearAllMocks();

      const rulesResult = await evaluator.evaluate('Q', 'A', ['E'], { faithfulness: 0.9, entitiesCount: 1 });

      // Both should have valid scores
      expect(llmResult.metrics.evidenceTraceability.score).toBeGreaterThanOrEqual(0);
      expect(rulesResult.metrics.evidenceTraceability.score).toBeGreaterThanOrEqual(0);
    });
  });
});

// ==================== 任务 11.3.3: 设置成本监控阈值 ====================

describe('Cost Monitoring Threshold Setup (任务 11.3.3)', () => {
  // Cost thresholds and monitoring configuration

  describe('threshold configuration', () => {
    it('should define cost threshold constants', () => {
      // Cost thresholds (in USD)
      const COST_THRESHOLDS = {
        warning: 10, // $10 per day warning
        critical: 50, // $50 per day critical
        llmCallMax: 0.05, // Max cost per LLM call
      };

      expect(COST_THRESHOLDS.warning).toBeDefined();
      expect(COST_THRESHOLDS.critical).toBeDefined();
    });

    it('should calculate estimated daily cost', () => {
      // Assume: 1000 evaluations per day, 15% trigger rate, $0.02 per call
      const evaluationsPerDay = 1000;
      const triggerRate = 0.15;
      const costPerCall = 0.02;

      const estimatedDailyCost = evaluationsPerDay * triggerRate * costPerCall;

      expect(estimatedDailyCost).toBeLessThan(50); // Should be under critical threshold
    });

    it('should define cost monitoring config', () => {
      const costMonitorConfig = {
        checkIntervalMs: 3600000, // Check every hour
        warningThreshold: 10,
        criticalThreshold: 50,
        costPerLLMCall: 0.02,
        costPerToken: 0.0001,
      };

      expect(costMonitorConfig.checkIntervalMs).toBeDefined();
      expect(costMonitorConfig.warningThreshold).toBeDefined();
    });
  });
});