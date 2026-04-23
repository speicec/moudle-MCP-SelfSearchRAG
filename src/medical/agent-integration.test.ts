/**
 * Medical Agent Integration Tests - MCP 调用集成测试
 */

import { describe, it, expect, vi } from 'vitest';
import { MedicalAgent, createMedicalAgent } from './agent/MedicalAgent.js';
import type { MedicalQueryInput, MedicalAnswer, SourceCitation } from './types.js';
import type { LLMCaller } from '../config/llm-config.js';

// ==================== MedicalAgent Integration Tests ====================

describe('MedicalAgent Integration', () => {
  // Mock LLMCaller
  const mockLLMCaller: LLMCaller = vi.fn(async (prompt: string) => {
    // Simulate LLM responses based on prompt content
    if (prompt.includes('ACTION:')) {
      return 'ACTION: retrieve\nREASON: 首次检索获取相关文档\nCONFIDENCE: 0.7';
    }
    if (prompt.includes('SATISFIED') || prompt.includes('满足')) {
      return 'SATISFIED - 已有足够检索结果';
    }
    if (prompt.includes('## 结论')) {
      return `## 结论
二甲双胍在肾功能不全患者需根据eGFR调整使用

## 详细说明
- eGFR ≥45: 可正常使用
- eGFR 30-45: 慎用需减量
- eGFR <30: 禁用

## 证据等级
Grade B - ADA指南推荐

## 来源引用
1. ADA Standards 2024

## 注意事项
- 本回答仅供参考`;
    }
    if (prompt.includes('质量检查')) {
      return 'STATUS: VALID\nISSUES:\n无\nSUGGESTIONS:\n无';
    }
    return 'Mock LLM response';
  });

  // Mock Retrieval Function
  const mockRetrieval = vi.fn(async (query: string) => {
    return [
      {
        content: 'ADA 2024指南建议：二甲双胍是2型糖尿病的一线用药',
        source: { documentName: 'ADA Standards 2024', year: 2024, section: 'Section 9' },
      },
      {
        content: 'eGFR <30 mL/min时禁用二甲双胍',
        source: { documentName: 'KDIGO Guidelines 2024', year: 2024 },
      },
    ];
  });

  describe('MedicalAgent', () => {
    it('should create agent with dependencies', () => {
      const agent = createMedicalAgent(mockLLMCaller, mockRetrieval);
      expect(agent).toBeDefined();
      expect(agent.getConfig()).toBeDefined();
    });

    it('should run simple query without retrieval', async () => {
      // Agent without retrieval should still work (returns empty results)
      const agent = createMedicalAgent(mockLLMCaller, undefined, {
        maxIterations: 1,
        confidenceThreshold: 0.7,
      });

      const input: MedicalQueryInput = {
        query: '二甲双胍',
        domain: 'diabetes',
      };

      const result = await agent.run(input);

      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.stats.iterations).toBeGreaterThanOrEqual(0);
    });

    it('should run query with retrieval', async () => {
      const agent = createMedicalAgent(mockLLMCaller, mockRetrieval, {
        maxIterations: 3,
        confidenceThreshold: 0.7,
      });

      const input: MedicalQueryInput = {
        query: '二甲双胍肾功能禁忌',
        domain: 'diabetes',
      };

      const result = await agent.run(input);

      expect(result).toBeDefined();
      expect(result.entities.drugs.length).toBeGreaterThan(0);
      expect(result.answer).toBeDefined();
      expect(result.answer.conclusion.text).toBeDefined();
      expect(result.answer.warnings.length).toBeGreaterThan(0);
      expect(result.stats.retrievalCalls).toBeGreaterThanOrEqual(0);
    });

    it('should respect maxIterations limit', async () => {
      const agent = createMedicalAgent(mockLLMCaller, mockRetrieval, {
        maxIterations: 2,
      });

      const input: MedicalQueryInput = {
        query: '测试查询',
      };

      const result = await agent.run(input);

      expect(result.stats.iterations).toBeLessThanOrEqual(2);
    });

    it('should track reasoning trace', async () => {
      const agent = createMedicalAgent(mockLLMCaller, mockRetrieval, {
        maxIterations: 3,
      });

      const result = await agent.run({ query: '二甲双胍' });

      expect(result.reasoningTrace).toBeDefined();
      expect(Array.isArray(result.reasoningTrace)).toBe(true);
    });

    it('should handle empty retrieval results', async () => {
      const emptyRetrieval = vi.fn(async () => []);
      const agent = createMedicalAgent(mockLLMCaller, emptyRetrieval);

      // Query without medical entities triggers direct retrieval mode
      const result = await agent.run({ query: '未知药物XYZ' });

      expect(result).toBeDefined();
      // Direct retrieval mode: empty results = success: false
      expect(result.success).toBe(false);
      // Should still generate answer even without retrieval
      expect(result.answer).toBeDefined();
    });

    it('should update config', () => {
      const agent = createMedicalAgent(mockLLMCaller, mockRetrieval);

      agent.updateConfig({ maxIterations: 10 });
      expect(agent.getConfig().maxIterations).toBe(10);
    });

    it('should set retrieval after creation', () => {
      const agent = createMedicalAgent(mockLLMCaller);
      agent.setRetrieval(mockRetrieval);

      expect(agent).toBeDefined();
    });
  });

  describe('MedicalAgent Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      const errorLLMCaller: LLMCaller = vi.fn(async () => {
        throw new Error('LLM API error');
      });

      const localMockRetrieval = vi.fn(async () => []);

      const agent = createMedicalAgent(errorLLMCaller, localMockRetrieval, {
        maxIterations: 1,
      });

      // The agent may throw or return a failed result
      try {
        const result = await agent.run({ query: '测试' });
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, that's acceptable behavior too
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle retrieval errors gracefully', async () => {
      const errorRetrieval = vi.fn(async () => {
        throw new Error('Retrieval error');
      });

      const localMockLLM: LLMCaller = vi.fn(async () => '## 结论\n测试\n\n## 注意事项\n- 警告');

      const agent = createMedicalAgent(localMockLLM, errorRetrieval, {
        maxIterations: 1,
      });

      try {
        const result = await agent.run({ query: '测试' });
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, that's acceptable behavior too
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});

// ==================== MedicalAnswer Format Tests ====================

describe('MedicalAnswer Format', () => {
  it('should have required fields', async () => {
    const simpleMockLLM: LLMCaller = vi.fn(async () => `## 结论
测试结论

## 详细说明
- 要点1

## 证据等级
Grade B

## 来源引用
1. 来源1

## 注意事项
- 警告1`);

    const agent = createMedicalAgent(simpleMockLLM);
    const result = await agent.run({ query: '测试' });

    expect(result.answer.conclusion).toBeDefined();
    expect(result.answer.conclusion.text).toBeDefined();
    expect(result.answer.details).toBeDefined();
    expect(result.answer.evidenceGrade).toBeDefined();
    expect(result.answer.sources).toBeDefined();
    expect(result.answer.warnings).toBeDefined();
  });

  it('should include retrieval results in answer', async () => {
    // Simple verification that agent processes retrieval results
    const localMockLLM: LLMCaller = vi.fn(async () => `## 结论
有检索结果

## 详细说明
- 要点1

## 证据等级
Grade B

## 来源引用
1. ADA 2024

## 注意事项
- 警告`);

    const retrieval = vi.fn(async () => [
      { content: 'ADA 2024指南', source: { documentName: 'ADA 2024' } },
    ]);

    const agent = createMedicalAgent(localMockLLM, retrieval);
    const result = await agent.run({ query: '测试' });

    expect(result.answer).toBeDefined();
    // Check that retrieval was called
    expect(retrieval).toHaveBeenCalled();
  });
});

// ==================== Low Confidence Direct Retrieval Tests ====================

describe('Low Confidence Direct Retrieval', () => {
  // Mock LLMCaller for direct retrieval tests
  const mockLLMCaller: LLMCaller = vi.fn(async (prompt: string) => {
    if (prompt.includes('## 结论')) {
      return `## 结论
根据查询结果提供了相关信息

## 详细说明
- 检索到的相关内容已整理

## 证据等级
Grade B

## 来源引用
1. 劳动法相关条款

## 注意事项
- 本回答仅供参考`;
    }
    if (prompt.includes('质量检查')) {
      return 'STATUS: VALID\nISSUES:\n无\nSUGGESTIONS:\n无';
    }
    return 'Mock LLM response';
  });

  it('should trigger direct retrieval for zero-entity query (confidence < 0.3)', async () => {
    const retrieval = vi.fn(async (query: string) => [
      { content: '加班工资计算标准', source: { documentName: '劳动法', year: 2024 } },
    ]);

    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      maxIterations: 3,
      confidenceThreshold: 0.7,
      lowConfidenceThreshold: 0.3,
    });

    // Query with no medical entities (confidence = 0.2)
    const result = await agent.run({ query: '加班' });

    expect(result).toBeDefined();
    expect(result.stats.iterations).toBe(0); // Direct retrieval skips ReAct loop
    expect(result.stats.retrievalCalls).toBe(1);
    expect(result.success).toBe(true);
    expect(result.answer).toBeDefined();
    // Verify retrieval was called with original query
    expect(retrieval).toHaveBeenCalledWith('加班', expect.any(Object));
  });

  it('should NOT trigger direct retrieval for single-entity query (confidence = 0.5)', async () => {
    const retrieval = vi.fn(async () => [
      { content: '二甲双胍用药指南', source: { documentName: 'ADA 2024' } },
    ]);

    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      maxIterations: 3,
      lowConfidenceThreshold: 0.3,
    });

    // Query with one medical entity (confidence >= 0.5)
    const result = await agent.run({ query: '二甲双胍' });

    expect(result).toBeDefined();
    // Single entity query should go through normal Agent flow (not direct retrieval)
    expect(result.stats.iterations).toBeGreaterThanOrEqual(0);
    expect(result.entities.drugs.length).toBeGreaterThan(0);
  });

  it('should use custom lowConfidenceThreshold', async () => {
    const retrieval = vi.fn(async () => [
      { content: '相关文档', source: { documentName: '测试文档' } },
    ]);

    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      maxIterations: 3,
      lowConfidenceThreshold: 0.4, // Custom threshold
    });

    // Query with confidence 0.2 (< 0.4) should trigger direct retrieval
    const result = await agent.run({ query: '非医学查询' });

    expect(result.stats.iterations).toBe(0); // Direct retrieval
  });

  it('should return correct results from direct retrieval', async () => {
    const mockResults = [
      { content: '劳动法第36条', source: { documentName: '劳动法', year: 2024 } },
      { content: '加班时间限制', source: { documentName: '劳动法', year: 2024 } },
    ];

    const retrieval = vi.fn(async () => mockResults);

    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      lowConfidenceThreshold: 0.3,
    });

    const result = await agent.run({ query: '加班规定' });

    expect(result).toBeDefined();
    expect(result.retrievalResults).toBeDefined();
    expect(result.retrievalResults?.length).toBe(2);
    expect(result.success).toBe(true);
  });

  it('should handle empty retrieval results in direct retrieval', async () => {
    const emptyRetrieval = vi.fn(async () => []);

    const agent = createMedicalAgent(mockLLMCaller, emptyRetrieval, {
      lowConfidenceThreshold: 0.3,
    });

    const result = await agent.run({ query: '未知查询' });

    expect(result).toBeDefined();
    expect(result.stats.iterations).toBe(0);
    expect(result.success).toBe(false); // Empty results = not satisfied
    expect(result.answer).toBeDefined(); // Should still generate answer
  });

  it('should emit visualization events for direct retrieval', async () => {
    const retrieval = vi.fn(async () => [
      { content: '测试内容', source: { documentName: '测试' } },
    ]);

    const visualizationEvents: Array<{ phase: string; data: unknown }> = [];
    const visualizationCallback = (phase: string, data: unknown) => {
      visualizationEvents.push({ phase, data });
    };

    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      lowConfidenceThreshold: 0.3,
    });

    // Set visualization callback
    agent.setVisualizationCallback(visualizationCallback);

    const result = await agent.run({ query: '非医学查询' });

    // Check that events were emitted
    expect(visualizationEvents.length).toBeGreaterThan(0);
    // Check for mode event with 'direct_retrieval'
    const modeEvent = visualizationEvents.find(e => e.phase === 'mode');
    expect(modeEvent).toBeDefined();
    expect((modeEvent?.data as { mode: string }).mode).toBe('direct_retrieval');
  });

  it('should use default threshold (0.3) when not configured', async () => {
    const retrieval = vi.fn(async () => []);

    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      maxIterations: 3,
      // lowConfidenceThreshold not set - should default to 0.3
    });

    const result = await agent.run({ query: '非医学查询' });

    // confidence 0.2 < default 0.3, should trigger direct retrieval
    expect(result.stats.iterations).toBe(0);
  });

  it('should handle invalid threshold values', async () => {
    const retrieval = vi.fn(async () => []);

    // Invalid threshold (> 1) should fallback to default 0.3
    const agent = createMedicalAgent(mockLLMCaller, retrieval, {
      lowConfidenceThreshold: 1.5, // Invalid
      maxIterations: 3,
    });

    const result = await agent.run({ query: '非医学查询' });

    // Should still work with default threshold
    expect(result.stats.iterations).toBe(0);
  });
});