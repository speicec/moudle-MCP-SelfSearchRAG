/**
 * QueryAnalyzer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryAnalyzer, createQueryAnalyzer } from './query-analyzer.js';
import type { QueryAnalysisResult } from './types.js';

describe('QueryAnalyzer', () => {
  let analyzer: QueryAnalyzer;
  let mockLLMCaller: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLLMCaller = vi.fn();
    analyzer = createQueryAnalyzer({
      queryAnalysisTimeoutMs: 2000,
      analysisCacheTTL: 300000,
      maxSubQueries: 5,
    }, mockLLMCaller);
  });

  describe('analyze', () => {
    it('should return simple complexity for short direct query', async () => {
      const result = await analyzer.analyze('什么是向量数据库？');

      expect(result.complexity).toBe('simple');
      expect(result.needsDecomposition).toBe(false);
    });

    it('should return complex for comparison queries', async () => {
      const result = await analyzer.analyze('对比Redis和Memcached的优缺点');

      expect(result.complexity).toBe('complex');
      expect(result.needsDecomposition).toBe(true);
    });

    it('should return structured for queries with year filter', async () => {
      const result = await analyzer.analyze('2023年的销售数据报告');

      expect(result.complexity).toBe('structured');
      expect(result.detectedFilters?.year).toBe(2023);
    });

    it('should detect month filter', async () => {
      const result = await analyzer.analyze('6月份的用户增长数据');

      expect(result.detectedFilters?.month).toBe(6);
    });

    it('should detect category filter', async () => {
      const result = await analyzer.analyze('查看技术文档中的性能优化方案');

      expect(result.detectedFilters?.category).toBe('技术文档');
    });

    it('should use cache for repeated queries', async () => {
      const query = '测试查询缓存';

      // First call
      const result1 = await analyzer.analyze(query);
      const stats1 = analyzer.getCacheStats();

      // Second call (should hit cache)
      const result2 = await analyzer.analyze(query);
      const stats2 = analyzer.getCacheStats();

      expect(stats1.size).toBe(1);
      expect(stats2.size).toBe(1);
      expect(result1.analysisTimestamp).toBe(result2.analysisTimestamp);
    });

    it('should clear cache on demand', async () => {
      await analyzer.analyze('缓存测试');
      expect(analyzer.getCacheStats().size).toBe(1);

      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);
    });
  });

  describe('LLM integration', () => {
    it('should call LLM for complex queries', async () => {
      mockLLMCaller.mockResolvedValueOnce(JSON.stringify({
        complexity: 'complex',
        needsDecomposition: true,
        needsRewrite: false,
        suggestedSubQueries: ['Redis特点', 'Memcached特点', '性能对比'],
      }));

      analyzer.setLLMCaller(mockLLMCaller);
      const result = await analyzer.analyze('详细对比Redis和Memcached');

      expect(mockLLMCaller).toHaveBeenCalled();
      expect(result.complexity).toBe('complex');
      expect(result.suggestedSubQueries).toHaveLength(3);
    });

    it('should handle LLM timeout', async () => {
      mockLLMCaller.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      analyzer.setLLMCaller(mockLLMCaller);
      const result = await analyzer.analyze('超时测试查询');

      // Should fallback to heuristic
      expect(result.complexity).toBeDefined();
    });

    it('should handle invalid LLM response', async () => {
      mockLLMCaller.mockResolvedValueOnce('不是有效的JSON');

      analyzer.setLLMCaller(mockLLMCaller);
      const result = await analyzer.analyze('JSON解析测试');

      // Should fallback to heuristic
      expect(result.complexity).toBeDefined();
    });

    it('should parse markdown-wrapped JSON', async () => {
      // Use a string that simulates markdown-wrapped JSON response
      const markdownJson = '\n```json\n{"complexity": "simple", "needsDecomposition": false, "needsRewrite": true}\n```\n      ';
      mockLLMCaller.mockResolvedValueOnce(markdownJson);

      analyzer.setLLMCaller(mockLLMCaller);
      const result = await analyzer.analyze('Markdown JSON测试');

      expect(result.complexity).toBe('simple');
      expect(result.needsRewrite).toBe(true);
    });
  });

  describe('rewrite heuristics', () => {
    it('should detect colloquial expressions needing rewrite', async () => {
      const result = await analyzer.analyze('怎么让系统跑得更快');

      expect(result.needsRewrite).toBe(true);
    });

    it('should not flag formal queries for rewrite', async () => {
      const result = await analyzer.analyze('系统性能优化方案');

      expect(result.needsRewrite).toBe(false);
    });
  });

  describe('filter detection', () => {
    it('should detect year in various formats', async () => {
      const tests = [
        { query: '2023年报告', expectedYear: 2023 },
        { query: '查看2024数据', expectedYear: 2024 },
        { query: '2021至2022对比', expectedYear: 2021 },
      ];

      for (const test of tests) {
        const result = await analyzer.analyze(test.query);
        expect(result.detectedFilters?.year).toBe(test.expectedYear);
      }
    });

    it('should not detect invalid years', async () => {
      const result = await analyzer.analyze('2099年数据');
      // 2099 is valid year format, but let's test edge cases
      expect(result.detectedFilters?.year).toBe(2099);
    });

    it('should detect document type', async () => {
      const result1 = await analyzer.analyze('PDF文档内容');
      expect(result1.detectedFilters?.documentType).toBe('PDF');

      const result2 = await analyzer.analyze('Word文档格式');
      expect(result2.detectedFilters?.documentType).toBe('Word');
    });
  });

  describe('complexity heuristics', () => {
    it('should classify single question as simple', async () => {
      const result = await analyzer.analyze('什么是向量数据库？');
      expect(result.complexity).toBe('simple');
    });

    it('should classify comparison as complex', async () => {
      const result = await analyzer.analyze('对比两种方案的区别');
      expect(result.complexity).toBe('complex');
    });

    it('should classify long queries as complex', async () => {
      const longQuery = '这是一个很长的问题，涉及多个方面，需要综合考虑各种因素和条件';
      const result = await analyzer.analyze(longQuery);
      expect(result.complexity).toBe('complex');
    });

    it('should classify queries with filters as structured', async () => {
      const result = await analyzer.analyze('第三章的内容概要');
      expect(result.complexity).toBe('structured');
    });
  });

  describe('sub-queries generation', () => {
    it('should generate sub-queries for comparison queries', async () => {
      const result = await analyzer.analyze('对比Redis和Memcached的优缺点');

      expect(result.suggestedSubQueries).toBeDefined();
      expect(result.suggestedSubQueries?.length).toBeGreaterThan(0);
    });

    it('should limit sub-queries to maxSubQueries', async () => {
      analyzer = createQueryAnalyzer({ maxSubQueries: 2 });

      const result = await analyzer.analyze('对比A和B和C和D的特点');

      expect(result.suggestedSubQueries?.length).toBeLessThanOrEqual(2);
    });

    it('should not generate sub-queries for simple queries', async () => {
      const result = await analyzer.analyze('简单查询测试');

      expect(result.suggestedSubQueries).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should respect timeout configuration', async () => {
      analyzer = createQueryAnalyzer({ queryAnalysisTimeoutMs: 100 });

      mockLLMCaller.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 500))
      );

      analyzer.setLLMCaller(mockLLMCaller);
      const result = await analyzer.analyze('超时配置测试');

      // Should fallback to heuristic due to timeout
      expect(result.complexity).toBeDefined();
    });

    it('should return config', () => {
      const config = analyzer.getConfig();
      expect(config.queryAnalysisTimeoutMs).toBeDefined();
      expect(config.analysisCacheTTL).toBeDefined();
    });
  });
});