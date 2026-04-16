/**
 * LocalReranker Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalReranker, createLocalReranker } from './local-reranker.js';
import type { ConfidenceRetrievalResult } from './types.js';
import { createDefaultConfidenceResult } from './types.js';

describe('LocalReranker', () => {
  let reranker: LocalReranker;

  // Helper to create mock results
  const createMockResult = (content: string, index: number): ConfidenceRetrievalResult => {
    return createDefaultConfidenceResult({
      smallChunkId: `chunk-${index}`,
      parentChunkId: `parent-${index}`,
      smallChunkContent: content.slice(0, 50),
      parentChunkContent: content,
      similarityScore: 0.5,
      sourceDocumentId: 'doc-1',
      metadata: { contentType: 'text' },
      expandedFromSmallChunk: true,
    });
  };

  beforeEach(() => {
    reranker = createLocalReranker();
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await reranker.initialize();
      const status = reranker.getStatus();

      expect(status.status).toBeDefined();
    });

    it('should set ready status with inference function', async () => {
      const mockInference = vi.fn().mockResolvedValue([
        { index: 0, score: 0.9 },
        { index: 1, score: 0.5 },
      ]);

      reranker.setInferenceFunction(mockInference);
      await reranker.initialize();

      expect(reranker.isReady()).toBe(true);
    });
  });

  describe('rerank', () => {
    it('should return scores for documents', async () => {
      reranker.setInferenceFunction(async (req) => {
        return req.documents.map((_, i) => ({ index: i, score: 0.5 + i * 0.1 }));
      });

      const results = await reranker.rerank(
        '性能优化',
        ['性能优化方案', '系统架构设计']
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeDefined();
      expect(results[1]?.score).toBeDefined();
    });

    it('should use mock inference when model not ready', async () => {
      const results = await reranker.rerank(
        '性能优化',
        ['性能优化方案', '系统架构设计']
      );

      expect(results).toHaveLength(2);
      // Mock should still return scores
      expect(results[0]?.score).toBeDefined();
    });

    it('should handle inference errors gracefully', async () => {
      reranker.setInferenceFunction(async () => {
        throw new Error('Inference error');
      });

      const results = await reranker.rerank(
        '性能优化',
        ['性能优化方案', '系统架构设计']
      );

      // Should fallback to mock
      expect(results).toHaveLength(2);
    });
  });

  describe('rerankResults', () => {
    it('should apply scores to ConfidenceRetrievalResults', async () => {
      reranker.setInferenceFunction(async (req) => {
        return req.documents.map((_, i) => ({
          index: i,
          score: 0.9 - i * 0.2,
        }));
      });

      const mockResults = [
        createMockResult('性能优化方案', 0),
        createMockResult('系统架构设计', 1),
        createMockResult('数据分析报告', 2),
      ];

      const scored = await reranker.rerankResults('性能优化', mockResults);

      expect(scored).toHaveLength(3);
      expect(scored[0]?.confidenceScore).toBeDefined();
      expect(scored[0]?.confidenceLevel).toBeDefined();
    });

    it('should sort results by confidence descending', async () => {
      reranker.setInferenceFunction(async (req) => {
        // Score based on content match
        const scores = req.documents.map((doc, i) => {
          const match = doc.includes('性能优化') ? 0.9 : 0.3;
          return { index: i, score: match };
        });
        return scores;
      });

      const mockResults = [
        createMockResult('系统架构设计', 0),
        createMockResult('性能优化方案', 1),
        createMockResult('数据分析报告', 2),
      ];

      const scored = await reranker.rerankResults('性能优化', mockResults);

      // Result with '性能优化' should be first
      expect(scored[0]?.parentChunkContent).toContain('性能优化');
      expect(scored[0]?.confidenceScore).toBeGreaterThan(scored[1]?.confidenceScore ?? 0);
    });

    it('should set correct confidence levels', async () => {
      reranker.setInferenceFunction(async () => [
        { index: 0, score: 0.85 },
        { index: 1, score: 0.55 },
        { index: 2, score: 0.25 },
      ]);

      const mockResults = [
        createMockResult('内容一', 0),
        createMockResult('内容二', 1),
        createMockResult('内容三', 2),
      ];

      const scored = await reranker.rerankResults('测试', mockResults);

      expect(scored[0]?.confidenceLevel).toBe('high');
      expect(scored[1]?.confidenceLevel).toBe('medium');
      expect(scored[2]?.confidenceLevel).toBe('low');
    });
  });

  describe('mockInference', () => {
    it('should generate scores based on keyword overlap', async () => {
      const results = await reranker.rerank(
        '性能优化',
        ['性能优化响应时间提升', '系统架构设计']
      );

      // Document with keywords should score higher
      expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    });

    it('should handle empty documents', async () => {
      const results = await reranker.rerank('性能优化', ['']);

      expect(results).toHaveLength(1);
      expect(results[0]?.score).toBeDefined();
    });

    it('should handle Chinese keywords', async () => {
      const results = await reranker.rerank(
        '向量数据库',
        ['向量数据库检索系统', '普通文档']
      );

      expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    });
  });

  describe('shutdown', () => {
    it('should reset status after shutdown', async () => {
      reranker.setInferenceFunction(async () => []);
      await reranker.initialize();

      expect(reranker.isReady()).toBe(true);

      await reranker.shutdown();

      expect(reranker.isReady()).toBe(false);
    });

    it('should clear inference function', async () => {
      reranker.setInferenceFunction(async () => []);
      await reranker.shutdown();

      const results = await reranker.rerank('测试', ['文档']);

      // Should use mock after shutdown
      expect(results).toHaveLength(1);
    });
  });

  describe('status and configuration', () => {
    it('should return status', () => {
      const status = reranker.getStatus();

      expect(status.status).toBe('not_loaded');
    });

    it('should return configuration', () => {
      const config = reranker.getConfig();

      expect(config.model).toBeDefined();
      expect(config.status).toBeDefined();
    });

    it('should use configured model name', () => {
      reranker = createLocalReranker({
        localRerankerModel: 'custom-model',
      });

      const config = reranker.getConfig();
      expect(config.model).toBe('custom-model');
    });
  });

  describe('isReady', () => {
    it('should return false initially', () => {
      expect(reranker.isReady()).toBe(false);
    });

    it('should return true after setting inference function', async () => {
      reranker.setInferenceFunction(async () => []);
      await reranker.initialize();

      expect(reranker.isReady()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle large number of documents', async () => {
      const documents = Array(50).fill('测试文档内容');

      const results = await reranker.rerank('测试', documents);

      expect(results).toHaveLength(50);
    });

    it('should handle very long documents', async () => {
      const longDoc = '这是一个非常长的文档内容'.repeat(100);

      const results = await reranker.rerank('测试', [longDoc]);

      expect(results).toHaveLength(1);
      expect(results[0]?.score).toBeDefined();
    });

    it('should handle empty query', async () => {
      const results = await reranker.rerank('', ['文档']);

      expect(results).toHaveLength(1);
    });
  });
});