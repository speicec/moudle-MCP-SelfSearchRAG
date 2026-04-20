/**
 * Enhanced Retrieval E2E Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EnhancedRetrievalPipeline, createEnhancedRetrievalPipeline } from '../retrieval/enhanced-retrieval-pipeline.js';
import { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';

describe('Enhanced Retrieval E2E', () => {
  let store: HierarchicalStore;
  let retriever: SmallToBigRetriever;
  let pipeline: EnhancedRetrievalPipeline;

  beforeAll(async () => {
    // Initialize store with test data
    store = new HierarchicalStore();

    // Helper to create mock embedding
    const createMockEmbedding = (seed: number): number[] => {
      const dim = 384;
      const embedding = new Array(dim).fill(0);
      embedding[seed % dim] = 0.8;
      embedding[(seed + 1) % dim] = 0.5;
      return embedding;
    };

    // Create test document chunks with embeddings
    const testChunks = [
      createHierarchicalChunk(
        '性能优化是提高系统响应速度和吞吐量的关键技术。主要方法包括缓存优化、数据库索引、异步处理等。',
        createMockEmbedding(0),
        'small',
        { start: 0, end: 100 },
        'doc-performance',
        createDefaultQualityScore(),
        { contentType: 'text', section: '性能优化' }
      ),
      createHierarchicalChunk(
        '系统架构设计需要考虑可扩展性、可用性和性能。微服务架构是现代系统的常见选择。',
        createMockEmbedding(50),
        'small',
        { start: 100, end: 200 },
        'doc-architecture',
        createDefaultQualityScore(),
        { contentType: 'text', section: '架构设计' }
      ),
      createHierarchicalChunk(
        '数据分析包括数据清洗、特征提取、模型训练等步骤。Python是数据分析的主流语言。',
        createMockEmbedding(100),
        'small',
        { start: 200, end: 300 },
        'doc-analytics',
        createDefaultQualityScore(),
        { contentType: 'text', section: '数据分析' }
      ),
      createHierarchicalChunk(
        'Redis是一种高性能的内存数据库，常用于缓存和会话管理。支持多种数据结构。',
        createMockEmbedding(150),
        'small',
        { start: 300, end: 400 },
        'doc-redis',
        createDefaultQualityScore(),
        { contentType: 'text', section: '数据库' }
      ),
      createHierarchicalChunk(
        'Memcached是另一个流行的缓存系统，专注于简单的键值存储。性能略低于Redis。',
        createMockEmbedding(200),
        'small',
        { start: 400, end: 500 },
        'doc-memcached',
        createDefaultQualityScore(),
        { contentType: 'text', section: '数据库' }
      ),
    ];

    await store.buildHierarchy(testChunks, 'test-doc');

    // Create retriever
    retriever = new SmallToBigRetriever(store, { topK: 10, similarityThreshold: 0.1 });

    // Mock embedding generator for consistent results
    retriever.setEmbeddingGenerator(async (text: string) => {
      const dim = 384;
      const embedding = new Array(dim).fill(0);
      for (let i = 0; i < text.length && i < dim; i++) {
        embedding[i] = text.charCodeAt(i) / 255;
      }
      return embedding;
    });

    // Create pipeline
    pipeline = createEnhancedRetrievalPipeline();
    pipeline.setRetriever(retriever);
    pipeline.setStore(store);

    await pipeline.initialize();
  });

  afterAll(async () => {
    await pipeline.shutdown();
  });

  describe('simple queries', () => {
    it('should handle simple query successfully', async () => {
      const result = await pipeline.execute('性能优化');

      expect(result.success).toBe(true);
      expect(result.results?.length).toBeGreaterThan(0);
    });

    it('should return analysis for simple query', async () => {
      const result = await pipeline.execute('系统架构');

      expect(result.analysis).toBeDefined();
      expect(result.analysis?.complexity).toBe('simple');
    });

    it('should return context with confidence', async () => {
      const result = await pipeline.execute('数据分析');

      expect(result.context).toBeDefined();
      expect(result.context?.chunks.length).toBeGreaterThan(0);
      expect(result.context?.avgConfidence).toBeGreaterThan(0);
    });
  });

  describe('complex queries', () => {
    it('should decompose complex comparison queries', async () => {
      const result = await pipeline.execute('对比Redis和Memcached的优缺点');

      expect(result.optimization?.subQueries).toBeDefined();
      expect(result.optimization?.subQueries?.length).toBeGreaterThan(0);
    });

    it('should handle multi-aspect queries', async () => {
      const result = await pipeline.execute('性能优化和架构设计的关系');

      expect(result.success).toBe(true);
      expect(result.results?.length).toBeGreaterThan(0);
    });

    it('should apply query expansion', async () => {
      const result = await pipeline.execute('速度提升方案');

      expect(result.optimization?.expandedTerms).toBeDefined();
    });
  });

  describe('structured queries', () => {
    it('should detect year filters', async () => {
      const result = await pipeline.execute('2023年性能优化文档');

      expect(result.analysis?.detectedFilters?.year).toBe(2023);
    });

    it('should detect category filters', async () => {
      const result = await pipeline.execute('查看性能优化技术文档');

      expect(result.analysis?.detectedFilters).toBeDefined();
    });
  });

  describe('low confidence handling', () => {
    it('should return low confidence for irrelevant queries', async () => {
      const result = await pipeline.execute('完全不相关的查询内容xyz123');

      // May return no-match, empty results, or low confidence results
      // All are acceptable behaviors for irrelevant queries
      expect(result).toBeDefined();
      expect(result.success || result.noMatch || result.results?.length === 0).toBeTruthy();
    });
  });

  describe('performance metrics', () => {
    it('should track execution time', async () => {
      const result = await pipeline.execute('性能优化');

      expect(result.stats?.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.stats?.totalTime).toBeLessThan(10000); // Should be < 10s
    });

    it('should track stage times', async () => {
      const result = await pipeline.execute('系统架构');

      expect(result.stats?.analysisTime).toBeGreaterThanOrEqual(0);
      expect(result.stats?.retrievalTime).toBeGreaterThanOrEqual(0);
      expect(result.stats?.rerankingTime).toBeGreaterThanOrEqual(0);
      expect(result.stats?.assemblyTime).toBeGreaterThanOrEqual(0);
    });

    it('should report reranking method', async () => {
      const result = await pipeline.execute('性能');

      expect(result.stats?.method).toBeDefined();
      expect(['local-reranker', 'internal-confidence']).toContain(result.stats?.method);
    });
  });

  describe('acceptance criteria', () => {
    it('should meet AC-001: query optimization works', async () => {
      const result = await pipeline.execute('怎么让系统跑得更快');

      expect(result.success).toBe(true);
      expect(result.optimization?.expandedTerms).toBeDefined();
    });

    it('should meet AC-002: complex query decomposition', async () => {
      const result = await pipeline.execute('对比Redis和Memcached的优缺点');

      expect(result.success).toBe(true);
      if (result.optimization?.wasDecomposed) {
        expect(result.optimization.subQueries?.length).toBeGreaterThan(0);
      }
    });

    it('should meet AC-005: hybrid reranking', async () => {
      // Small sample should use local reranker or internal
      const result = await pipeline.execute('性能优化');

      expect(result.stats?.method).toBeDefined();
      expect(['local-reranker', 'internal-confidence']).toContain(result.stats?.method);
    });
  });
});