/**
 * Layer3Evaluator Tests
 *
 * 任务 5.2.5: 测试 Prompt 输出格式稳定性
 * 任务 5.6.1: 编写 Layer3Evaluator 单元测试
 * 任务 5.6.2: 编写批量 Prompt 测试
 * 任务 5.6.3: 编写条件触发测试
 * 任务 5.6.4: 编写 JSON 解析测试（成功和失败场景）
 * 任务 5.6.5: 编写 Pipeline 集成测试
 * 任务 5.6.6: 测试成本对比（规则 vs LLM）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Layer3Evaluator, createLayer3Evaluator, type Layer3Response, type TriggerAnalysis } from '../Layer3Evaluator.js';
import type { LLMCaller } from '../../config/llm-config.js';

// Mock LLMCaller
const createMockLLMCaller = () => vi.fn();

// 标准有效响应
const VALID_RESPONSE: Layer3Response = {
  evidenceTraceability: {
    score: 0.85,
    unsupportedClaims: ['声明A没有证据支持'],
    hallucinationRisk: false,
    reasoning: '大部分声明有证据支持',
  },
  completeness: {
    score: 0.9,
    missingElements: ['缺少药物相互作用说明'],
    coveragePercentage: 90,
    reasoning: '覆盖了主要方面',
  },
  terminologyAccuracy: {
    score: 0.95,
    incorrectTerms: [],
    suggestedCorrections: [],
    reasoning: '术语使用准确',
  },
};

// ==================== 任务 5.2.5: Prompt 输出格式稳定性测试 ====================

describe('Prompt Output Format Stability (任务 5.2.5)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('buildBatchPrompt', () => {
    it('should generate consistent prompt format', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluator.evaluate(
        '二甲双胍的禁忌症是什么？',
        '二甲双胍禁用于肾功能不全患者，eGFR < 30 mL/min。',
        ['二甲双胍在肾功能不全时禁用...']
      );

      // Verify prompt was called
      expect(mockLLMCaller).toHaveBeenCalled();
      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      // Prompt should contain required sections
      expect(prompt).toContain('用户问题');
      expect(prompt).toContain('系统回答');
      expect(prompt).toContain('证据片段');
      expect(prompt).toContain('Evidence Traceability');
      expect(prompt).toContain('Completeness');
      expect(prompt).toContain('Terminology Accuracy');
      expect(prompt).toContain('JSON');
    });

    it('should truncate long inputs', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const longAnswer = '这是一个非常长的回答'.repeat(200);
      const longChunks = ['这是一个非常长的证据片段'.repeat(50)];

      await evaluator.evaluate('测试问题', longAnswer, longChunks);

      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      // Prompt should be truncated (not exceed reasonable length)
      expect(prompt.length).toBeLessThan(10000);
    });

    it('should handle multiple chunks correctly', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluator.evaluate(
        '问题',
        '回答',
        ['证据1', '证据2', '证据3', '证据4', '证据5', '证据6']
      );

      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      // Should include chunk references
      expect(prompt).toContain('[1]');
      expect(prompt).toContain('[2]');
      expect(prompt).toContain('[3]');
    });
  });

  describe('response parsing stability', () => {
    it('should parse clean JSON response', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.metrics.evidenceTraceability.score).toBe(0.85);
      expect(result.metrics.completeness.score).toBe(0.9);
      expect(result.metrics.terminologyAccuracy.score).toBe(0.95);
      expect(result.llmUsed).toBe(true);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should parse JSON wrapped in markdown', async () => {
      mockLLMCaller.mockResolvedValue(`这是分析结果：
\`\`\`json
${JSON.stringify(VALID_RESPONSE)}
\`\`\`
`);

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.llmUsed).toBe(true);
      expect(result.metrics.evidenceTraceability.score).toBe(0.85);
    });

    it('should parse JSON with surrounding text', async () => {
      mockLLMCaller.mockResolvedValue(`好的，以下是评估结果：
${JSON.stringify(VALID_RESPONSE)}
这是我的分析。`);

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.llmUsed).toBe(true);
    });
  });
});

// ==================== 任务 5.6.1: Layer3Evaluator 单元测试 ====================

describe('Layer3Evaluator Unit Tests (任务 5.6.1)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with LLM caller', () => {
      expect(evaluator).toBeDefined();
    });

    it('should accept conditional trigger option', () => {
      const evaluatorWithConditional = new Layer3Evaluator(mockLLMCaller as LLMCaller, {
        useConditionalTrigger: false,
      });

      expect(evaluatorWithConditional).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('should return Layer3SystemResult structure', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.evidenceTraceability).toBeDefined();
      expect(result.metrics.completeness).toBeDefined();
      expect(result.metrics.terminologyAccuracy).toBeDefined();
      expect(result.triggeredBy).toBeDefined();
      expect(result.llmUsed).toBeDefined();
      expect(result.fallbackUsed).toBeDefined();
    });

    it('should call LLM when conditional trigger is disabled', async () => {
      const evaluatorNoConditional = new Layer3Evaluator(mockLLMCaller as LLMCaller, {
        useConditionalTrigger: false,
      });

      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluatorNoConditional.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.9, // High faithfulness, normally wouldn't trigger
      });

      expect(mockLLMCaller).toHaveBeenCalled();
    });
  });

  describe('createLayer3Evaluator factory', () => {
    it('should create evaluator instance', () => {
      const evaluator = createLayer3Evaluator(mockLLMCaller as LLMCaller);

      expect(evaluator).toBeDefined();
      expect(evaluator).toBeInstanceOf(Layer3Evaluator);
    });
  });
});

// ==================== 任务 5.6.2: 批量 Prompt 测试 ====================

describe('Batch Prompt Tests (任务 5.6.2)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller, { useConditionalTrigger: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('prompt structure', () => {
    it('should include all three evaluation metrics', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluator.evaluate('问题', '回答', ['证据']);

      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      expect(prompt).toContain('Evidence Traceability');
      expect(prompt).toContain('Completeness');
      expect(prompt).toContain('Terminology Accuracy');
    });

    it('should include output format specification', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluator.evaluate('问题', '回答', ['证据']);

      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      expect(prompt).toContain('输出格式');
      expect(prompt).toContain('json');
      expect(prompt).toContain('score');
      expect(prompt).toContain('reasoning');
    });

    it('should handle empty chunks', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluator.evaluate('问题', '回答', []);

      expect(mockLLMCaller).toHaveBeenCalled();
    });
  });
});

// ==================== 任务 5.6.3: 条件触发测试 ====================

describe('Conditional Trigger Tests (任务 5.6.3)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller, { useConditionalTrigger: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('faithfulness trigger', () => {
    it('should trigger LLM when faithfulness < 0.7', async () => {
      await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      expect(mockLLMCaller).toHaveBeenCalled();
      const result = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      expect(result.triggeredBy.triggers.faithfulness).toBe(true);
      expect(result.triggeredBy.shouldTriggerLLM).toBe(true);
    });

    it('should not trigger LLM when faithfulness >= 0.7', async () => {
      vi.clearAllMocks();

      await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.8,
        entitiesCount: 1,
      });

      // Should use fallback (no trigger)
      expect(mockLLMCaller).not.toHaveBeenCalled();
    });
  });

  describe('multi-entity trigger', () => {
    it('should trigger LLM when entitiesCount > 1', async () => {
      await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.9,
        entitiesCount: 3,
      });

      expect(mockLLMCaller).toHaveBeenCalled();
    });

    it('should not trigger LLM when entitiesCount <= 1', async () => {
      vi.clearAllMocks();

      await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.9,
        entitiesCount: 1,
      });

      expect(mockLLMCaller).not.toHaveBeenCalled();
    });
  });

  describe('combined triggers', () => {
    it('should trigger when multiple conditions met', async () => {
      await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.6,
        entitiesCount: 3,
      });

      const result = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.6,
        entitiesCount: 3,
      });

      expect(result.triggeredBy.triggers.faithfulness).toBe(true);
      expect(result.triggeredBy.triggers.multiEntity).toBe(true);
      expect(result.triggeredBy.reasons.length).toBe(2);
    });
  });

  describe('no metrics provided', () => {
    it('should use fallback when no metrics', async () => {
      vi.clearAllMocks();

      await evaluator.evaluate('问题', '回答', ['证据']);

      expect(mockLLMCaller).not.toHaveBeenCalled();
    });
  });
});

// ==================== 任务 5.6.4: JSON 解析测试 ====================

describe('JSON Parsing Tests (任务 5.6.4)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller, { useConditionalTrigger: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful parsing', () => {
    it('should parse valid JSON', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.llmUsed).toBe(true);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should clamp invalid scores to valid range', async () => {
      const responseWithInvalidScore = {
        ...VALID_RESPONSE,
        evidenceTraceability: {
          ...VALID_RESPONSE.evidenceTraceability,
          score: 1.5, // Invalid > 1
        },
      };

      mockLLMCaller.mockResolvedValue(JSON.stringify(responseWithInvalidScore));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      // Score should be clamped to 1
      expect(result.metrics.evidenceTraceability.score).toBeLessThanOrEqual(1);
    });

    it('should handle missing optional fields', async () => {
      const partialResponse = {
        evidenceTraceability: {
          score: 0.8,
        },
        completeness: {
          score: 0.9,
        },
        terminologyAccuracy: {
          score: 0.95,
        },
      };

      mockLLMCaller.mockResolvedValue(JSON.stringify(partialResponse));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.llmUsed).toBe(true);
      expect(result.metrics.evidenceTraceability.details.unsupportedClaims).toEqual([]);
    });

    it('should add default reasoning when missing', async () => {
      const responseNoReasoning = {
        evidenceTraceability: { score: 0.8, unsupportedClaims: [], hallucinationRisk: false },
        completeness: { score: 0.9, missingElements: [], coveragePercentage: 90 },
        terminologyAccuracy: { score: 0.95, incorrectTerms: [], suggestedCorrections: [] },
      };

      mockLLMCaller.mockResolvedValue(JSON.stringify(responseNoReasoning));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.llmUsed).toBe(true);
    });
  });

  describe('failure handling', () => {
    it('should fallback on invalid JSON', async () => {
      mockLLMCaller.mockResolvedValue('这不是JSON');

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.llmUsed).toBe(false);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should fallback on empty response', async () => {
      mockLLMCaller.mockResolvedValue('');

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.fallbackUsed).toBe(true);
    });

    it('should fallback on LLM error', async () => {
      mockLLMCaller.mockRejectedValue(new Error('LLM API error'));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.fallbackUsed).toBe(true);
    });

    it('should provide valid fallback metrics', async () => {
      mockLLMCaller.mockRejectedValue(new Error('LLM error'));

      const result = await evaluator.evaluate('问题', '回答', ['证据']);

      expect(result.metrics.evidenceTraceability.score).toBeDefined();
      expect(result.metrics.completeness.score).toBeDefined();
      expect(result.metrics.terminologyAccuracy.score).toBeDefined();
      expect(result.metrics.evidenceTraceability.score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.evidenceTraceability.score).toBeLessThanOrEqual(1);
    });
  });
});

// ==================== 任务 5.6.5: Pipeline 集成测试 ====================

describe('Pipeline Integration Tests (任务 5.6.5)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('integration with evaluation pipeline', () => {
    it('should produce metrics compatible with pipeline', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const result = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      // Metrics should be in expected format
      expect(result.metrics.evidenceTraceability.score).toBeDefined();
      expect(result.metrics.evidenceTraceability.details).toBeDefined();
      expect(result.metrics.completeness.score).toBeDefined();
      expect(result.metrics.terminologyAccuracy.score).toBeDefined();
    });

    it('should provide trigger analysis for pipeline', async () => {
      const result = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      expect(result.triggeredBy).toBeDefined();
      expect(result.triggeredBy.shouldTriggerLLM).toBeDefined();
      expect(result.triggeredBy.triggers).toBeDefined();
      expect(result.triggeredBy.reasons).toBeDefined();
    });

    it('should indicate LLM usage for cost tracking', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const result = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      expect(result.llmUsed).toBe(true);
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('conditional trigger integration', () => {
    it('should respect trigger conditions in pipeline', async () => {
      // First call with trigger
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const triggeredResult = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      expect(triggeredResult.llmUsed).toBe(true);

      // Second call without trigger
      vi.clearAllMocks();

      const notTriggeredResult = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.9,
        entitiesCount: 1,
      });

      expect(notTriggeredResult.llmUsed).toBe(false);
    });
  });
});

// ==================== 任务 5.6.6: 成本对比测试 ====================

describe('Cost Comparison Tests (任务 5.6.6)', () => {
  let evaluator: Layer3Evaluator;
  let mockLLMCaller: ReturnType<typeof createMockLLMCaller>;

  beforeEach(() => {
    mockLLMCaller = createMockLLMCaller();
    evaluator = new Layer3Evaluator(mockLLMCaller as LLMCaller);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('LLM vs Rules cost comparison', () => {
    it('should track LLM usage for cost calculation', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      // With trigger
      const llmResult = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      expect(llmResult.llmUsed).toBe(true);

      // Without trigger
      vi.clearAllMocks();

      const rulesResult = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.9,
        entitiesCount: 1,
      });

      expect(rulesResult.llmUsed).toBe(false);
    });

    it('should estimate token usage from prompt', async () => {
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      const prompt = mockLLMCaller.mock.calls[0]?.[0] as string;

      // Prompt should be reasonably sized for cost efficiency
      // Approximate: 4 chars per token
      const estimatedTokens = Math.ceil(prompt.length / 4);
      expect(estimatedTokens).toBeLessThan(2000);
    });

    it('should demonstrate conditional trigger cost savings', async () => {
      // Run 10 evaluations with mixed triggers
      const evaluations = [];
      for (let i = 0; i < 10; i++) {
        const faithfulness = i < 3 ? 0.5 : 0.9; // 3 trigger, 7 no trigger
        const entitiesCount = i < 3 ? 2 : 1;

        mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

        const result = await evaluator.evaluate(`问题${i}`, `回答${i}`, ['证据'], {
          faithfulness,
          entitiesCount,
        });

        evaluations.push(result.llmUsed);
        vi.clearAllMocks();
      }

      // Count LLM calls
      const llmCallsCount = evaluations.filter(Boolean).length;
      // With conditional trigger, should have fewer LLM calls
      expect(llmCallsCount).toBeLessThan(10);
    });

    it('should provide quality vs cost trade-off info', async () => {
      // LLM evaluation
      mockLLMCaller.mockResolvedValue(JSON.stringify(VALID_RESPONSE));

      const llmResult = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      // Rules fallback
      mockLLMCaller.mockRejectedValue(new Error('Failed'));

      const fallbackResult = await evaluator.evaluate('问题', '回答', ['证据'], {
        faithfulness: 0.5,
      });

      // Both should provide valid scores
      expect(llmResult.metrics.evidenceTraceability.score).toBeGreaterThanOrEqual(0);
      expect(fallbackResult.metrics.evidenceTraceability.score).toBeGreaterThanOrEqual(0);

      // LLM should have more detailed reasoning
      expect(llmResult.metrics.evidenceTraceability.details.reasoning).toBeDefined();
    });
  });
});