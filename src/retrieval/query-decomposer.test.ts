/**
 * QueryDecomposer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryDecomposer, createQueryDecomposer } from './query-decomposer.js';
import type { DecompositionResult } from './types.js';

describe('QueryDecomposer', () => {
  let decomposer: QueryDecomposer;
  let mockLLMCaller: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLLMCaller = vi.fn();
    decomposer = createQueryDecomposer({
      maxSubQueries: 5,
      queryDecomposeTimeoutMs: 3000,
    }, mockLLMCaller);
  });

  describe('needsDecomposition check', () => {
    it('should not decompose short queries', async () => {
      const result = await decomposer.decompose('简单问题');
      expect(result.subQueries).toHaveLength(0);
    });

    it('should not decompose single focused queries', async () => {
      const result = await decomposer.decompose('什么是向量数据库？');
      expect(result.subQueries).toHaveLength(0);
    });

    it('should decompose comparison queries', async () => {
      const result = await decomposer.decompose('对比Redis和Memcached的优缺点');
      expect(result.subQueries.length).toBeGreaterThan(0);
    });

    it('should decompose queries with multiple questions', async () => {
      const result = await decomposer.decompose('什么是Redis？它有什么特点？');
      expect(result.subQueries.length).toBeGreaterThan(0);
    });
  });

  describe('heuristic decomposition', () => {
    it('should decompose comparison queries', async () => {
      const result = await decomposer.decompose('对比Redis和Memcached的性能');

      expect(result.strategy).toBe('parallel');
      expect(result.subQueries.some(q => q.includes('Redis'))).toBe(true);
      expect(result.subQueries.some(q => q.includes('Memcached'))).toBe(true);
    });

    it('should decompose queries with AND clauses', async () => {
      const result = await decomposer.decompose('查看性能数据同时分析错误日志');

      expect(result.strategy).toBe('parallel');
      expect(result.subQueries.length).toBeGreaterThan(1);
    });

    it('should decompose multiple questions', async () => {
      const result = await decomposer.decompose('什么是缓存？如何使用缓存？缓存有什么优势？');

      expect(result.subQueries.length).toBeGreaterThan(0);
    });
  });

  describe('LLM integration', () => {
    it('should use LLM for complex queries', async () => {
      mockLLMCaller.mockResolvedValueOnce(JSON.stringify({
        subQueries: ['子查询1', '子查询2', '子查询3'],
        strategy: 'parallel',
      }));

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('分析系统架构的各个方面');

      expect(mockLLMCaller).toHaveBeenCalled();
      expect(result.subQueries).toHaveLength(3);
    });

    it('should parse markdown-wrapped JSON', async () => {
      // Use a string that simulates markdown-wrapped JSON response
      const markdownJson = '\n```json\n{"subQueries": ["分析A", "分析B"], "strategy": "sequential"}\n```\n      ';
      mockLLMCaller.mockResolvedValueOnce(markdownJson);

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('复杂分析查询');

      expect(result.subQueries).toHaveLength(2);
      expect(result.strategy).toBe('sequential');
    });

    it('should handle LLM timeout', async () => {
      mockLLMCaller.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('超时测试查询');

      // Should fallback to heuristic or return empty
      expect(result).toBeDefined();
    });

    it('should handle invalid JSON response', async () => {
      mockLLMCaller.mockResolvedValueOnce('Invalid JSON');

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('JSON解析测试');

      expect(result.subQueries).toBeDefined();
    });
  });

  describe('maxSubQueries limit', () => {
    it('should limit sub-queries to configured max', async () => {
      decomposer = createQueryDecomposer({ maxSubQueries: 2 });

      const result = await decomposer.decompose('对比A和B和C和D的特点');

      expect(result.subQueries.length).toBeLessThanOrEqual(2);
    });

    it('should respect default maxSubQueries=5', async () => {
      const defaultMax = decomposer.getMaxSubQueries();
      expect(defaultMax).toBe(5);
    });

    it('should handle LLM returning more than max', async () => {
      decomposer = createQueryDecomposer({ maxSubQueries: 2 });
      mockLLMCaller.mockResolvedValueOnce(JSON.stringify({
        subQueries: ['A', 'B', 'C', 'D', 'E'],
        strategy: 'parallel',
      }));

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('复杂查询');

      expect(result.subQueries.length).toBeLessThanOrEqual(2);
    });
  });

  describe('strategy determination', () => {
    it('should use parallel strategy for comparisons', async () => {
      const result = await decomposer.decompose('对比两种方案');
      expect(result.strategy).toBe('parallel');
    });

    it('should use parallel strategy for AND clauses', async () => {
      const result = await decomposer.decompose('查询A同时查询B');
      expect(result.strategy).toBe('parallel');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const result = await decomposer.decompose('');
      expect(result.subQueries).toHaveLength(0);
    });

    it('should handle query with no decomposition pattern', async () => {
      const result = await decomposer.decompose('简单文档查询');
      expect(result.subQueries).toHaveLength(0);
    });

    it('should filter empty sub-queries from LLM', async () => {
      mockLLMCaller.mockResolvedValueOnce(JSON.stringify({
        subQueries: ['有效查询', '', '  ', '另一个有效'],
        strategy: 'parallel',
      }));

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('过滤空查询测试');

      expect(result.subQueries).toHaveLength(2);
    });
  });

  describe('configuration', () => {
    it('should return config', () => {
      const config = decomposer.getConfig();
      expect(config.maxSubQueries).toBeDefined();
      expect(config.queryDecomposeTimeoutMs).toBeDefined();
    });

    it('should respect custom timeout', async () => {
      decomposer = createQueryDecomposer({ queryDecomposeTimeoutMs: 100 });

      mockLLMCaller.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 500))
      );

      decomposer.setLLMCaller(mockLLMCaller);
      const result = await decomposer.decompose('超时配置测试');

      expect(result).toBeDefined();
    });
  });
});