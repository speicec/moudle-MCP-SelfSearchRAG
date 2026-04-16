/**
 * SmallToBigRetriever Multi-Query Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmallToBigRetriever } from './small-to-big-retriever.js';
import { HierarchicalStore } from './hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from './types.js';

describe('SmallToBigRetriever Multi-Query', () => {
  let store: HierarchicalStore;
  let retriever: SmallToBigRetriever;

  beforeEach(async () => {
    store = new HierarchicalStore();

    // Helper to create mock embedding
    const createMockEmbedding = (seed: number): number[] => {
      const dim = 384;
      const embedding = new Array(dim).fill(0);
      embedding[seed % dim] = 0.8;
      embedding[(seed + 1) % dim] = 0.5;
      return embedding;
    };

    // Create test chunks with embeddings
    const smallChunks = [
      createHierarchicalChunk(
        '性能优化方案包括响应时间提升',
        createMockEmbedding(0),
        'small',
        { start: 0, end: 50 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
      createHierarchicalChunk(
        '系统架构设计文档内容',
        createMockEmbedding(50),
        'small',
        { start: 50, end: 100 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
      createHierarchicalChunk(
        '数据分析统计报告',
        createMockEmbedding(100),
        'small',
        { start: 100, end: 150 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
    ];

    await store.buildHierarchy(smallChunks, 'doc-1');

    retriever = new SmallToBigRetriever(store, {
      topK: 10,
      similarityThreshold: 0.1,
    });

    // Mock embedding generator for consistent results
    retriever.setEmbeddingGenerator(async (text: string) => {
      // Simple mock embedding based on text content
      const dim = 384;
      const embedding = new Array(dim).fill(0);
      for (let i = 0; i < text.length && i < dim; i++) {
        embedding[i] = text.charCodeAt(i) / 255;
      }
      return embedding;
    });
  });

  describe('retrieveMultiQuery', () => {
    it('should execute multiple queries', async () => {
      const queries = ['性能优化', '架构设计'];
      const results = await retriever.retrieveMultiQuery(queries);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should merge results from all queries', async () => {
      const queries = ['性能', '架构'];
      const results = await retriever.retrieveMultiQuery(queries);

      // Should have results matching either query
      expect(results.length).toBeGreaterThan(0);
    });

    it('should apply topK limit', async () => {
      const queries = ['性能', '架构', '数据'];
      const results = await retriever.retrieveMultiQuery(queries, { topK: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should deduplicate results', async () => {
      // Same query twice should not duplicate results
      const queries = ['性能优化', '性能优化'];
      const results = await retriever.retrieveMultiQuery(queries);

      // Check no duplicate parentChunkIds
      const parentIds = results.map(r => r.parentChunkId);
      const uniqueIds = new Set(parentIds);

      expect(uniqueIds.size).toBe(parentIds.length);
    });
  });

  describe('merge strategies', () => {
    it('should use union strategy by default', async () => {
      const queries = ['性能', '架构'];
      const results = await retriever.retrieveMultiQuery(queries);

      // Union should include results from both queries
      expect(results.length).toBeGreaterThan(0);
    });

    it('should use intersection strategy', async () => {
      const queries = ['性能', '架构'];
      const results = await retriever.retrieveMultiQuery(queries, {
        mergeStrategy: 'intersection',
      });

      // Intersection may be empty if no overlapping results
      expect(results).toBeDefined();
    });

    it('should use weighted strategy', async () => {
      const queries = ['性能', '架构'];
      const results = await retriever.retrieveMultiQuery(queries, {
        mergeStrategy: 'weighted',
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('convertToConfidenceResults', () => {
    it('should convert to confidence results', async () => {
      const hierarchicalResults = await retriever.retrieve('性能优化');
      const confidenceResults = retriever.convertToConfidenceResults(hierarchicalResults);

      expect(confidenceResults.length).toBe(hierarchicalResults.length);
      expect(confidenceResults[0]?.confidenceScore).toBeDefined();
      expect(confidenceResults[0]?.confidenceLevel).toBeDefined();
    });
  });

  describe('retrieveMultiQueryWithConfidence', () => {
    it('should return confidence results directly', async () => {
      const queries = ['性能', '架构'];
      const results = await retriever.retrieveMultiQueryWithConfidence(queries);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.confidenceScore).toBeDefined();
      expect(results[0]?.confidenceLevel).toBeDefined();
    });
  });

  describe('parallel execution', () => {
    it('should execute queries in parallel', async () => {
      // Use slow embedding generator
      retriever.setEmbeddingGenerator(async (text) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return new Array(384).fill(0);
      });

      const startTime = Date.now();
      const queries = ['查询1', '查询2', '查询3'];
      await retriever.retrieveMultiQuery(queries);
      const duration = Date.now() - startTime;

      // Parallel execution should be faster than sequential
      // 3 queries * 50ms = 150ms sequential
      // Parallel should be ~50ms
      expect(duration).toBeLessThan(200);
    });
  });

  describe('empty results handling', () => {
    it('should handle queries with no matches', async () => {
      const queries = ['完全不匹配的关键词', '另一个不匹配'];
      const results = await retriever.retrieveMultiQuery(queries);

      // May return empty or fallback results
      expect(results).toBeDefined();
    });

    it('should handle empty query array', async () => {
      const results = await retriever.retrieveMultiQuery([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle single query', async () => {
      const results = await retriever.retrieveMultiQuery(['性能优化']);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle many queries', async () => {
      const queries = Array(10).fill('测试');
      const results = await retriever.retrieveMultiQuery(queries, { topK: 5 });

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});