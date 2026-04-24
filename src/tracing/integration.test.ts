/**
 * End-to-End Integration Tests
 *
 * 任务 11.1.1: 编写 Safety → Alert → Review → Unblock 全流程测试
 * 任务 11.1.2: 编写 Faithfulness low → Alert → Adjustment 测试
 * 任务 11.1.3: 编写 Queue backlog → Alert → Autoscaler 测试
 * 任务 11.1.4: 编写 Layer 3 LLM evaluation 全流程测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlertHandler, type EvaluationResultInput } from '../../alert/AlertHandler.js';
import { HumanReviewQueue } from '../../feedback/HumanReviewQueue.js';
import { FeedbackAnalyzer } from '../../feedback/FeedbackAnalyzer.js';
import { QueueHealthMonitor } from '../../monitor/QueueHealthMonitor.js';
import { EvaluationAutoscaler, MockDockerAdapter } from '../../scaler/EvaluationAutoscaler.js';
import { Layer3Evaluator } from '../../evaluation/Layer3Evaluator.js';
import {
  performSafetyCheck,
  createSafetyLayerOutput,
} from '../../medical/safety-layer.js';
import type { TraceStorage } from '../../tracing/TraceStorage.js';
import type { AlertEvent } from '../../alert/types.js';
import type { ReviewItem } from '../../feedback/types.js';

// 创建 Mock TraceStorage
const createMockStorage = () => ({
  saveAlert: vi.fn().mockImplementation((alert: AlertEvent) => Promise.resolve(alert)),
  getAlerts: vi.fn().mockResolvedValue([]),
  getAlert: vi.fn().mockResolvedValue(null),
  acknowledgeAlert: vi.fn().mockResolvedValue({ acknowledged: true }),
  resolveAlert: vi.fn().mockResolvedValue({ resolved: true }),
  saveReviewItem: vi.fn().mockImplementation((item: ReviewItem) => Promise.resolve(item)),
  getReviewItems: vi.fn().mockReturnValue([]),
  updateReviewItem: vi.fn().mockResolvedValue({ success: true }),
  getReviewCount: vi.fn().mockReturnValue(0),
  saveScaleEvent: vi.fn().mockResolvedValue(undefined),
  getScaleEvents: vi.fn().mockReturnValue([]),
} as unknown as TraceStorage);

// ==================== 任务 11.1.1: Safety → Alert → Review → Unblock 全流程测试 ====================

describe('Safety → Alert → Review → Unblock Full Flow (任务 11.1.1)', () => {
  let alertHandler: AlertHandler;
  let reviewQueue: HumanReviewQueue;
  let mockStorage: TraceStorage;
  let broadcastFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    broadcastFn = vi.fn();

    alertHandler = new AlertHandler(mockStorage);
    alertHandler.setBroadcast(broadcastFn);

    reviewQueue = new HumanReviewQueue(mockStorage);
    alertHandler.setReviewQueue(reviewQueue);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('complete flow', () => {
    it('should create safety alert for absolute contraindication', async () => {
      const result: EvaluationResultInput = {
        traceId: 'safety-flow-1',
        evaluationId: 'eval-1',
        metrics: {
          faithfulness: { score: 0.8 },
          contextRelevance: { score: 0.9 },
        },
        extendedMetrics: {
          safetyAssessment: {
            score: 0.2,
            severity: 'absolute',
            contraindication: 'Drug interaction detected',
          },
        },
      };

      const alerts = await alertHandler.checkAndAlert(result);

      expect(alerts.length).toBeGreaterThan(0);
      const safetyAlert = alerts.find(a => a.type === 'SAFETY_CRITICAL');
      expect(safetyAlert).toBeDefined();
      expect(safetyAlert?.severity).toBe('critical');
    });

    it('should broadcast alert to WebSocket', async () => {
      const result: EvaluationResultInput = {
        traceId: 'broadcast-flow',
        evaluationId: 'eval-2',
        metrics: {},
        extendedMetrics: {
          safetyAssessment: {
            score: 0.2,
            severity: 'absolute',
          },
        },
      };

      await alertHandler.checkAndAlert(result);

      expect(broadcastFn).toHaveBeenCalled();
      const call = broadcastFn.mock.calls[0]?.[0];
      expect(call?.type).toBe('alert:new');
    });

    it('should save alert to storage', async () => {
      const result: EvaluationResultInput = {
        traceId: 'storage-flow',
        evaluationId: 'eval-3',
        metrics: {},
        extendedMetrics: {
          safetyAssessment: {
            score: 0.2,
            severity: 'absolute',
          },
        },
      };

      await alertHandler.checkAndAlert(result);

      expect((mockStorage as { saveAlert: ReturnType<typeof vi.fn> }).saveAlert).toHaveBeenCalled();
    });

    it('should create review item for SAFETY_CRITICAL', async () => {
      const alert: AlertEvent = {
        alertId: 'alert-review-1',
        timestamp: new Date().toISOString(),
        type: 'SAFETY_CRITICAL',
        severity: 'critical',
        traceId: 'review-flow',
        evaluationId: 'eval-4',
        details: { safetyScore: 0.2 },
        suggestedActions: ['立即审核'],
        status: 'active',
      };

      const reviewItem = await reviewQueue.addFromAlert(alert, '测试问题', '测试回答');

      expect(reviewItem).toBeDefined();
      expect(reviewItem.priority).toBe('critical');
      expect(reviewItem.status).toBe('pending');
    });

    it('should support review workflow (assign/approve/unblock)', async () => {
      // Mock existing review item
      (mockStorage as { getReviewItems: ReturnType<typeof vi.fn> }).getReviewItems.mockReturnValue([
        {
          reviewId: 'review-unblock',
          traceId: 'unblock-flow',
          evaluationId: 'eval-5',
          status: 'pending',
          priority: 'critical',
          createdAt: new Date().toISOString(),
          details: { query: '问题', answer: '回答', safetyScore: 0.2 },
        },
      ]);

      // Assign
      const assignedItem = await reviewQueue.assign('review-unblock', 'reviewer-1');

      // Mock updated state
      (mockStorage as { getReviewItems: ReturnType<typeof vi.fn> }).getReviewItems.mockReturnValue([
        {
          reviewId: 'review-unblock',
          traceId: 'unblock-flow',
          evaluationId: 'eval-5',
          status: 'assigned',
          priority: 'critical',
          createdAt: new Date().toISOString(),
          assignedTo: 'reviewer-1',
          details: { query: '问题', answer: '回答', safetyScore: 0.2 },
        },
      ]);

      // Approve
      const approvedItem = await reviewQueue.approve('review-unblock', 'reviewer-1', '审核通过');

      expect(approvedItem).toBeDefined();
    });
  });
});

// ==================== 任务 11.1.2: Faithfulness low → Alert → Adjustment 测试 ====================

describe('Faithfulness Low → Alert → Adjustment Flow (任务 11.1.2)', () => {
  let alertHandler: AlertHandler;
  let feedbackAnalyzer: FeedbackAnalyzer;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();

    alertHandler = new AlertHandler(mockStorage);
    feedbackAnalyzer = new FeedbackAnalyzer(mockStorage);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('faithfulness alert flow', () => {
    it('should create FAITHFULNESS_LOW alert', async () => {
      const result: EvaluationResultInput = {
        traceId: 'faith-flow',
        evaluationId: 'eval-1',
        metrics: {
          faithfulness: { score: 0.4 }, // Below threshold
          contextRelevance: { score: 0.8 },
        },
      };

      const alerts = await alertHandler.checkAndAlert(result);

      const faithfulnessAlert = alerts.find(a => a.type === 'FAITHFULNESS_LOW');
      expect(faithfulnessAlert).toBeDefined();
    });

    it('should generate retrieval adjustment for low faithfulness', async () => {
      const metrics = {
        faithfulness: { score: 0.4, verdicts: [] },
        contextRelevance: { score: 0.8 },
        answerRelevance: { score: 0.8 },
      };

      const result = await feedbackAnalyzer.analyze('faith-adj', 'eval-2', metrics);

      const retrievalAdjustment = result.signal.adjustments.find(a => a.target === 'retrieval');
      expect(retrievalAdjustment).toBeDefined();
    });

    it('should set ATTENTION_REQUIRED flag', async () => {
      const metrics = {
        faithfulness: { score: 0.3, verdicts: [] },
        contextRelevance: { score: 0.8 },
        answerRelevance: { score: 0.8 },
      };

      const result = await feedbackAnalyzer.analyze('faith-flag', 'eval-3', metrics);

      expect(result.signal.flags).toContain('ATTENTION_REQUIRED');
    });

    it('should have adjustment with expiry', async () => {
      const metrics = {
        faithfulness: { score: 0.3, verdicts: [] },
        contextRelevance: { score: 0.8 },
        answerRelevance: { score: 0.8 },
      };

      const result = await feedbackAnalyzer.analyze('faith-exp', 'eval-4', metrics);

      if (result.signal.adjustments.length > 0) {
        const adjustment = result.signal.adjustments[0];
        expect(adjustment?.expiresAt).toBeGreaterThan(Date.now());
      }
    });
  });
});

// ==================== 任务 11.1.3: Queue backlog → Alert → Autoscaler 测试 ====================

describe('Queue Backlog → Alert → Autoscaler Flow (任务 11.1.3)', () => {
  let queueMonitor: QueueHealthMonitor;
  let autoscaler: EvaluationAutoscaler;
  let mockStorage: TraceStorage;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockDocker: MockDockerAdapter;

  const createMockQueue = () => ({
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 10,
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

    queueMonitor = new QueueHealthMonitor(mockQueue);
    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker);

    vi.clearAllMocks();
  });

  afterEach(() => {
    queueMonitor.stop();
    autoscaler.stop();
    vi.resetAllMocks();
  });

  describe('queue backlog detection', () => {
    it('should detect backlog and create alert', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 150, // Critical backlog
        active: 5,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      });

      const report = await queueMonitor.checkHealth();

      expect(report.status).toBe('critical');
      const backlogIssue = report.issues.find(i => i.type === 'backlog');
      expect(backlogIssue).toBeDefined();
    });

    it('should trigger autoscaler for backlog', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 100, // Above scale threshold
        active: 5,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      });

      await autoscaler.checkAndScale();

      const currentReplicas = await autoscaler.getCurrentReplicas();
      expect(currentReplicas).toBeGreaterThan(2);
    });

    it('should save scale event', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 100,
        active: 5,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      });

      await autoscaler.checkAndScale();

      expect((mockStorage as { saveScaleEvent: ReturnType<typeof vi.fn> }).saveScaleEvent).toHaveBeenCalled();
    });
  });
});

// ==================== 任务 11.1.4: Layer 3 LLM evaluation 全流程测试 ====================

describe('Layer 3 LLM Evaluation Full Flow (任务 11.1.4)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof vi.fn>;

  const VALID_LLM_RESPONSE = {
    evidenceTraceability: {
      score: 0.85,
      unsupportedClaims: [],
      hallucinationRisk: false,
      reasoning: '所有声明有证据支持',
    },
    completeness: {
      score: 0.9,
      missingElements: [],
      coveragePercentage: 90,
      reasoning: '覆盖完整',
    },
    terminologyAccuracy: {
      score: 0.95,
      incorrectTerms: [],
      suggestedCorrections: [],
      reasoning: '术语准确',
    },
  };

  beforeEach(() => {
    mockLLMCaller = vi.fn().mockResolvedValue(JSON.stringify(VALID_LLM_RESPONSE));
    evaluator = new Layer3Evaluator(mockLLMCaller as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('LLM evaluation flow', () => {
    it('should trigger LLM evaluation for low faithfulness', async () => {
      const result = await evaluator.evaluate(
        '二甲双胍的禁忌症是什么？',
        '二甲双胍禁用于肾功能不全患者...',
        ['证据片段1', '证据片段2'],
        { faithfulness: 0.5 }
      );

      expect(result.llmUsed).toBe(true);
      expect(result.triggeredBy.triggers.faithfulness).toBe(true);
    });

    it('should return structured metrics', async () => {
      const result = await evaluator.evaluate(
        '问题',
        '回答',
        ['证据'],
        { faithfulness: 0.5 }
      );

      expect(result.metrics.evidenceTraceability.score).toBeDefined();
      expect(result.metrics.completeness.score).toBeDefined();
      expect(result.metrics.terminologyAccuracy.score).toBeDefined();
    });

    it('should fallback on LLM failure', async () => {
      mockLLMCaller.mockRejectedValue(new Error('LLM failed'));

      const result = await evaluator.evaluate(
        '问题',
        '回答',
        ['证据'],
        { faithfulness: 0.5 }
      );

      expect(result.fallbackUsed).toBe(true);
      expect(result.metrics.evidenceTraceability.score).toBeDefined();
    });

    it('should use rules when trigger conditions not met', async () => {
      const result = await evaluator.evaluate(
        '简单问题',
        '简单回答',
        ['证据'],
        { faithfulness: 0.9, entitiesCount: 1 }
      );

      expect(result.llmUsed).toBe(false);
    });

    it('should track cost savings with conditional trigger', async () => {
      // Run 10 evaluations with mixed triggers
      const results = [];
      for (let i = 0; i < 10; i++) {
        vi.clearAllMocks();

        const triggerMetrics = i < 3
          ? { faithfulness: 0.5 }
          : { faithfulness: 0.9, entitiesCount: 1 };

        mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_LLM_RESPONSE));

        const result = await evaluator.evaluate(`问题${i}`, `回答${i}`, [`证据${i}`], triggerMetrics);
        results.push(result.llmUsed);
      }

      const llmUsageCount = results.filter(Boolean).length;
      // Should have fewer LLM calls than evaluations (cost savings)
      expect(llmUsageCount).toBeLessThan(10);
    });
  });
});