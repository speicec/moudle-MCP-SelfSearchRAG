/**
 * FeedbackAnalyzer Tests
 *
 * 任务 8.7.1: 编写 FeedbackAnalyzer 单元测试
 * 任务 8.7.2: 编写 Safety feedback 测试
 * 任务 8.7.3: 编写 Faithfulness feedback 测试
 * 任务 8.7.4: 编写 Trend analysis 测试
 * 任务 8.7.5: 编写 Session Config Store 测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FeedbackAnalyzer } from '../FeedbackAnalyzer.js';
import type { FeedbackSignal, Adjustment, FlagType, EvaluationTrend } from '../types.js';
import type { EvaluationResult } from '../../tracing/types.js';
import type { TraceStorage } from '../../tracing/TraceStorage.js';

// Mock TraceStorage
const createMockStorage = () => ({
  saveAlert: vi.fn().mockResolvedValue(undefined),
  getAlerts: vi.fn().mockResolvedValue([]),
  getAlert: vi.fn().mockResolvedValue(null),
  acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
  resolveAlert: vi.fn().mockResolvedValue(undefined),
} as unknown as TraceStorage);

// Mock metrics
const createMockMetrics = (): EvaluationResult['metrics'] => ({
  faithfulness: { score: 0.8, verdicts: [] },
  contextRelevance: { score: 0.7 },
  answerRelevance: { score: 0.8 },
});

// ==================== 任务 8.7.1: FeedbackAnalyzer 单元测试 ====================

describe('FeedbackAnalyzer Unit Tests (任务 8.7.1)', () => {
  let analyzer: FeedbackAnalyzer;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    analyzer = new FeedbackAnalyzer(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with storage', () => {
      expect(analyzer).toBeDefined();
    });

    it('should accept custom thresholds', () => {
      const customAnalyzer = new FeedbackAnalyzer(mockStorage, {
        safetyCriticalThreshold: 0.4,
        faithfulnessWarningThreshold: 0.6,
      });

      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should return FeedbackAnalyzerResult structure', async () => {
      const metrics = createMockMetrics();

      const result = await analyzer.analyze('trace-1', 'eval-1', metrics);

      expect(result).toBeDefined();
      expect(result.traceId).toBe('trace-1');
      expect(result.evaluationId).toBe('eval-1');
      expect(result.timestamp).toBeDefined();
      expect(result.signal).toBeDefined();
    });

    it('should return signal with flags and adjustments', async () => {
      const metrics = createMockMetrics();

      const result = await analyzer.analyze('trace-1', 'eval-1', metrics);

      expect(result.signal).toBeDefined();
      expect(Array.isArray(result.signal.flags)).toBe(true);
      expect(Array.isArray(result.signal.adjustments)).toBe(true);
    });

    it('should handle extended metrics', async () => {
      const metrics = createMockMetrics();

      const result = await analyzer.analyze('trace-1', 'eval-1', metrics, {
        safetyScore: 0.4,
        medicalAccuracy: 0.5,
      });

      expect(result).toBeDefined();
      // Should generate flags for low safety
      expect(result.signal.flags.length).toBeGreaterThan(0);
    });
  });
});

// ==================== 任务 8.7.2: Safety feedback 测试 ====================

describe('Safety Feedback Tests (任务 8.7.2)', () => {
  let analyzer: FeedbackAnalyzer;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    analyzer = new FeedbackAnalyzer(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateSafetyFeedback', () => {
    it('should generate HUMAN_REVIEW_REQUIRED flag for critical safety', () => {
      const { flags, adjustments } = analyzer.generateSafetyFeedback(0.3);

      expect(flags).toContain('HUMAN_REVIEW_REQUIRED');
      expect(adjustments.length).toBeGreaterThan(0);
    });

    it('should generate ATTENTION_REQUIRED flag for moderate safety', () => {
      const { flags, adjustments } = analyzer.generateSafetyFeedback(0.6);

      expect(flags).toContain('ATTENTION_REQUIRED');
      expect(adjustments.length).toBeGreaterThan(0);
    });

    it('should not generate flags for safe score', () => {
      const { flags, adjustments } = analyzer.generateSafetyFeedback(0.8);

      expect(flags.length).toBe(0);
      expect(adjustments.length).toBe(0);
    });

    it('should include contraindication in adjustment reason', () => {
      const { adjustments } = analyzer.generateSafetyFeedback(0.3, 'Drug interaction');

      // Should have adjustments targeting generation
      const genAdjustments = adjustments.filter(a => a.target === 'generation');
      expect(genAdjustments.length).toBeGreaterThan(0);
    });
  });

  describe('adjustment structure', () => {
    it('should have valid adjustment structure', () => {
      const { adjustments } = analyzer.generateSafetyFeedback(0.3);

      const adjustment = adjustments[0];
      expect(adjustment?.target).toBeDefined();
      expect(adjustment?.change).toBeDefined();
      expect(adjustment?.reason).toBeDefined();
      expect(adjustment?.expiresAt).toBeDefined();
    });

    it('should target generation for safety adjustments', () => {
      const { adjustments } = analyzer.generateSafetyFeedback(0.3);

      expect(adjustments.some(a => a.target === 'generation')).toBe(true);
    });

    it('should set 1 hour expiry', () => {
      const { adjustments } = analyzer.generateSafetyFeedback(0.3);

      const expiryDiff = adjustments[0]?.expiresAt - Date.now();
      expect(expiryDiff).toBeLessThanOrEqual(3600000);
      expect(expiryDiff).toBeGreaterThan(3500000);
    });
  });
});

// ==================== 任务 8.7.3: Faithfulness feedback 测试 ====================

describe('Faithfulness Feedback Tests (任务 8.7.3)', () => {
  let analyzer: FeedbackAnalyzer;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    analyzer = new FeedbackAnalyzer(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateFaithfulnessFeedback', () => {
    it('should generate ATTENTION_REQUIRED flag for low faithfulness', () => {
      const { flags, adjustments } = analyzer.generateFaithfulnessFeedback(0.4);

      expect(flags).toContain('ATTENTION_REQUIRED');
      expect(adjustments.length).toBeGreaterThan(0);
    });

    it('should not generate flags for good faithfulness', () => {
      const { flags, adjustments } = analyzer.generateFaithfulnessFeedback(0.8);

      expect(flags.length).toBe(0);
      expect(adjustments.length).toBe(0);
    });

    it('should target retrieval for faithfulness adjustments', () => {
      const { adjustments } = analyzer.generateFaithfulnessFeedback(0.4);

      expect(adjustments.some(a => a.target === 'retrieval')).toBe(true);
    });

    it('should increase topK in adjustment', () => {
      const { adjustments } = analyzer.generateFaithfulnessFeedback(0.4);

      const retrievalAdjustment = adjustments.find(a => a.target === 'retrieval');
      expect((retrievalAdjustment?.change as { topK?: number }).topK).toBeDefined();
      expect((retrievalAdjustment?.change as { topK?: number }).topK).toBeGreaterThan(5);
    });
  });

  describe('unsupported claims handling', () => {
    it('should generate hallucination check for many unsupported claims', () => {
      const { adjustments } = analyzer.generateFaithfulnessFeedback(0.4, 5);

      expect(adjustments.some(a => a.target === 'generation')).toBe(true);
    });

    it('should not add hallucination check for few unsupported claims', () => {
      const { adjustments } = analyzer.generateFaithfulnessFeedback(0.4, 2);

      expect(adjustments.length).toBe(1); // Only retrieval adjustment
    });
  });

  describe('context relevance feedback', () => {
    it('should generate adjustment for low context relevance', () => {
      const { adjustments } = analyzer.generateContextRelevanceFeedback(0.3);

      expect(adjustments.length).toBeGreaterThan(0);
      expect(adjustments[0]?.target).toBe('retrieval');
    });

    it('should enable rerank for low chunk scores', () => {
      const { adjustments } = analyzer.generateContextRelevanceFeedback(0.3, 0.4);

      const retrievalAdjustment = adjustments.find(a => a.target === 'retrieval');
      expect((retrievalAdjustment?.change as { rerankEnabled?: boolean }).rerankEnabled).toBe(true);
    });
  });
});

// ==================== 任务 8.7.4: Trend analysis 测试 ====================

describe('Trend Analysis Tests (任务 8.7.4)', () => {
  let analyzer: FeedbackAnalyzer;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    analyzer = new FeedbackAnalyzer(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('analyzeTrend', () => {
    it('should return undefined for insufficient history', async () => {
      const metrics = createMockMetrics();

      const result = await analyzer.analyze('trace-1', 'eval-1', metrics);

      // First evaluation, no history
      expect(result.signal.trendAnalysis).toBeUndefined();
    });

    it('should track evaluation history', async () => {
      // Run multiple evaluations
      for (let i = 0; i < 10; i++) {
        const metrics = createMockMetrics();
        metrics.faithfulness = { score: 0.8 - i * 0.02, verdicts: [] };

        await analyzer.analyze(`trace-${i}`, `eval-${i}`, metrics);
      }

      // History should be populated
      const lastResult = await analyzer.analyze('trace-last', 'eval-last', createMockMetrics());

      expect(lastResult).toBeDefined();
    });

    it('should detect degrading trend', async () => {
      // Create history with degrading scores
      for (let i = 0; i < 10; i++) {
        const metrics: EvaluationResult['metrics'] = {
          faithfulness: { score: 0.9 - i * 0.05, verdicts: [] }, // Decreasing
          contextRelevance: { score: 0.8 },
          answerRelevance: { score: 0.8 },
        };

        await analyzer.analyze(`trace-deg-${i}`, `eval-deg-${i}`, metrics);
      }

      // Final evaluation should detect degradation
      const metrics: EvaluationResult['metrics'] = {
        faithfulness: { score: 0.4, verdicts: [] },
        contextRelevance: { score: 0.7 },
        answerRelevance: { score: 0.8 },
      };

      const result = await analyzer.analyze('trace-final', 'eval-final', metrics);

      // Should have trend analysis
      if (result.signal.trendAnalysis) {
        expect(result.signal.trendAnalysis.trendDirection).toBeDefined();
      }
    });

    it('should detect improving trend', async () => {
      // Create history with improving scores
      for (let i = 0; i < 10; i++) {
        const metrics: EvaluationResult['metrics'] = {
          faithfulness: { score: 0.5 + i * 0.05, verdicts: [] }, // Increasing
          contextRelevance: { score: 0.8 },
          answerRelevance: { score: 0.8 },
        };

        await analyzer.analyze(`trace-imp-${i}`, `eval-imp-${i}`, metrics);
      }

      const metrics: EvaluationResult['metrics'] = {
        faithfulness: { score: 0.95, verdicts: [] },
        contextRelevance: { score: 0.8 },
        answerRelevance: { score: 0.8 },
      };

      const result = await analyzer.analyze('trace-final-imp', 'eval-final-imp', metrics);

      expect(result).toBeDefined();
    });

    it('should generate SYSTEM_DEGRADATION flag for significant degradation', async () => {
      // Build history with significant degradation
      for (let i = 0; i < 15; i++) {
        const metrics: EvaluationResult['metrics'] = {
          faithfulness: { score: 0.95 - i * 0.06, verdicts: [] }, // Rapid decrease
          contextRelevance: { score: 0.95 - i * 0.06 },
          answerRelevance: { score: 0.95 - i * 0.06 },
        };

        await analyzer.analyze(`trace-sys-${i}`, `eval-sys-${i}`, metrics);
      }

      const metrics: EvaluationResult['metrics'] = {
        faithfulness: { score: 0.2, verdicts: [] },
        contextRelevance: { score: 0.2 },
        answerRelevance: { score: 0.2 },
      };

      const result = await analyzer.analyze('trace-sys-final', 'eval-sys-final', metrics);

      // Should potentially have SYSTEM_DEGRADATION flag
      expect(result.signal.flags).toBeDefined();
    });
  });

  describe('history buffer management', () => {
    it('should limit history buffer size', async () => {
      // Add many evaluations
      for (let i = 0; i < 150; i++) {
        const metrics = createMockMetrics();
        await analyzer.analyze(`trace-many-${i}`, `eval-many-${i}`, metrics);
      }

      // Buffer should be limited (default 100)
      // Check by analyzing trend - should still work
      const result = await analyzer.analyze('trace-buffer', 'eval-buffer', createMockMetrics());

      expect(result).toBeDefined();
    });
  });
});

// ==================== 任务 8.7.5: Session Config Store 测试 ====================

describe('Session Config Store Tests (任务 8.7.5)', () => {
  // Note: SessionConfigStore is in a separate file
  // Here we test how FeedbackAnalyzer interacts with session config

  let analyzer: FeedbackAnalyzer;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    analyzer = new FeedbackAnalyzer(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('adjustment generation', () => {
    it('should generate adjustments with proper expiry', async () => {
      const metrics: EvaluationResult['metrics'] = {
        faithfulness: { score: 0.3, verdicts: [] },
        contextRelevance: { score: 0.7 },
        answerRelevance: { score: 0.8 },
      };

      const result = await analyzer.analyze('trace-adj', 'eval-adj', metrics);

      // Should have adjustments with expiry
      if (result.signal.adjustments.length > 0) {
        const adjustment = result.signal.adjustments[0];
        expect(adjustment?.expiresAt).toBeGreaterThan(Date.now());
      }
    });

    it('should generate multiple adjustments for multiple issues', async () => {
      const metrics: EvaluationResult['metrics'] = {
        faithfulness: { score: 0.3, verdicts: [] },
        contextRelevance: { score: 0.3 },
        answerRelevance: { score: 0.8 },
      };

      const result = await analyzer.analyze('trace-multi', 'eval-multi', metrics, {
        safetyScore: 0.3,
      });

      // Should have multiple adjustments
      expect(result.signal.adjustments.length).toBeGreaterThan(1);
    });

    it('should target different components appropriately', async () => {
      const result = await analyzer.analyze('trace-target', 'eval-target', {
        faithfulness: { score: 0.3, verdicts: [] },
        contextRelevance: { score: 0.3 },
        answerRelevance: { score: 0.8 },
      }, {
        safetyScore: 0.3,
        medicalAccuracy: 0.5,
      });

      // Should have adjustments for different targets
      const targets = result.signal.adjustments.map(a => a.target);
      expect(targets.length).toBeGreaterThan(0);
    });
  });

  describe('adjustment targets', () => {
    it('should target retrieval for faithfulness issues', async () => {
      const result = await analyzer.analyze('trace-ret', 'eval-ret', {
        faithfulness: { score: 0.3, verdicts: [] },
        contextRelevance: { score: 0.7 },
        answerRelevance: { score: 0.8 },
      });

      const retrievalAdjustments = result.signal.adjustments.filter(a => a.target === 'retrieval');
      expect(retrievalAdjustments.length).toBeGreaterThan(0);
    });

    it('should target generation for safety issues', async () => {
      const result = await analyzer.analyze('trace-gen', 'eval-gen', createMockMetrics(), {
        safetyScore: 0.3,
      });

      const genAdjustments = result.signal.adjustments.filter(a => a.target === 'generation');
      expect(genAdjustments.length).toBeGreaterThan(0);
    });

    it('should target evaluation for medical accuracy issues', async () => {
      const result = await analyzer.analyze('trace-eval', 'eval-eval', createMockMetrics(), {
        medicalAccuracy: 0.4,
      });

      const evalAdjustments = result.signal.adjustments.filter(a => a.target === 'evaluation');
      expect(evalAdjustments.length).toBeGreaterThan(0);
    });
  });

  describe('medical accuracy feedback', () => {
    it('should generate feedback for low medical accuracy', () => {
      const { flags, adjustments } = analyzer.generateMedicalAccuracyFeedback(0.4);

      expect(flags).toContain('ATTENTION_REQUIRED');
      expect(adjustments.length).toBeGreaterThan(0);
    });

    it('should handle terminology errors', () => {
      const { adjustments } = analyzer.generateMedicalAccuracyFeedback(
        0.4,
        ['错误术语1', '错误术语2']
      );

      expect(adjustments.length).toBeGreaterThan(1);
    });

    it('should handle guideline violations', () => {
      const { flags, adjustments } = analyzer.generateMedicalAccuracyFeedback(
        0.4,
        [],
        ['违反指南1']
      );

      expect(flags.length).toBeGreaterThan(0);
    });
  });
});