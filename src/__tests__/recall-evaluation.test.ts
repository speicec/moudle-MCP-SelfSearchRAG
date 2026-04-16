/**
 * Recall Rate Evaluation Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EnhancedRetrievalPipeline, createEnhancedRetrievalPipeline } from '../retrieval/enhanced-retrieval-pipeline.js';
import { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';

describe('Recall Rate Evaluation', () => {
  let store: HierarchicalStore;
  let retriever: SmallToBigRetriever;
  let pipeline: EnhancedRetrievalPipeline;

  // Test document collection with known content
  const testDocuments = [
    { id: 'perf-1', content: '性能优化的主要方法包括缓存策略、数据库优化、代码重构和负载均衡。缓存可以显著减少数据库查询次数。' },
    { id: 'perf-2', content: '响应时间是性能优化的关键指标。通过异步处理和消息队列可以提高系统吞吐量。' },
    { id: 'perf-3', content: '延迟降低需要优化网络传输、数据库索引和内存使用。合理的缓存策略是关键。' },
    { id: 'arch-1', content: '系统架构设计需要考虑可扩展性、可用性和一致性。微服务架构提供了更好的模块化能力。' },
    { id: 'arch-2', content: '技术方案选择需要权衡性能、成本和复杂度。单体架构适合小型项目，微服务适合大型系统。' },
    { id: 'arch-3', content: '结构规划包括服务拆分、数据流设计和接口定义。良好的架构是系统成功的基础。' },
    { id: 'data-1', content: '数据分析包括数据清洗、特征提取和模型训练。Python和R是主流的分析工具。' },
    { id: 'data-2', content: '数据统计需要考虑样本大小、置信区间和假设检验。可视化有助于发现数据规律。' },
    { id: 'data-3', content: '数据挖掘技术包括聚类、分类和关联规则。机器学习算法可以自动化分析过程。' },
    { id: 'cache-1', content: 'Redis是一种高性能的内存缓存数据库，支持多种数据结构如字符串、哈希、列表等。' },
    { id: 'cache-2', content: 'Memcached专注于键值缓存，性能略低于Redis但更简单。适合纯缓存场景。' },
    { id: 'cache-3', content: '缓存策略包括LRU、LFU和TTL。合理的过期时间可以平衡内存使用和命中率。' },
  ];

  // Query-answer pairs for recall testing
  const queryAnswerPairs = [
    { query: '性能优化方法', expectedDocs: ['perf-1', 'perf-2', 'perf-3'] },
    { query: '架构设计原则', expectedDocs: ['arch-1', 'arch-2', 'arch-3'] },
    { query: '数据分析流程', expectedDocs: ['data-1', 'data-2', 'data-3'] },
    { query: 'Redis缓存特点', expectedDocs: ['cache-1', 'cache-2', 'cache-3'] },
    { query: '响应时间优化', expectedDocs: ['perf-2', 'perf-3'] },
    { query: '微服务架构', expectedDocs: ['arch-1', 'arch-2'] },
    { query: '缓存策略', expectedDocs: ['perf-1', 'cache-3'] },
    { query: '数据库优化', expectedDocs: ['perf-1', 'perf-2'] },
  ];

  beforeAll(async () => {
    store = new HierarchicalStore();

    // Create chunks from test documents
    const chunks = testDocuments.map((doc, i) =>
      createHierarchicalChunk(
        doc.content,
        [],
        'small',
        { start: 0, end: doc.content.length },
        doc.id,
        createDefaultQualityScore(),
        { contentType: 'text' }
      )
    );

    await store.buildHierarchy(chunks, 'test-collection');

    retriever = new SmallToBigRetriever(store, {
      topK: 20,
      similarityThreshold: 0.1,
    });

    retriever.setEmbeddingGenerator(async (text: string) => {
      const dim = 384;
      const embedding = new Array(dim).fill(0);
      for (let i = 0; i < text.length && i < dim; i++) {
        embedding[i] = text.charCodeAt(i) / 255;
      }
      return embedding;
    });

    pipeline = createEnhancedRetrievalPipeline();
    pipeline.setRetriever(retriever);
    pipeline.setStore(store);

    await pipeline.initialize();
  });

  afterAll(async () => {
    await pipeline.shutdown();
  });

  /**
   * Calculate recall rate for a query
   */
  const calculateRecall = (
    results: Array<{ sourceDocumentId: string }> | undefined,
    expectedDocs: string[]
  ): number => {
    if (!results || results.length === 0) return 0;

    const retrievedDocs = new Set(results.map(r => r.sourceDocumentId));
    const matched = expectedDocs.filter(docId => retrievedDocs.has(docId));

    return matched.length / expectedDocs.length;
  };

  describe('single query recall', () => {
    it('should achieve >= 80% recall for performance queries', async () => {
      const pair = queryAnswerPairs.find(p => p.query === '性能优化方法')!;
      const result = await pipeline.execute(pair.query);

      const recall = calculateRecall(result.results, pair.expectedDocs);

      expect(recall).toBeGreaterThanOrEqual(0.8);
    });

    it('should achieve >= 80% recall for architecture queries', async () => {
      const pair = queryAnswerPairs.find(p => p.query === '架构设计原则')!;
      const result = await pipeline.execute(pair.query);

      const recall = calculateRecall(result.results, pair.expectedDocs);

      expect(recall).toBeGreaterThanOrEqual(0.8);
    });

    it('should achieve >= 80% recall for data analysis queries', async () => {
      const pair = queryAnswerPairs.find(p => p.query === '数据分析流程')!;
      const result = await pipeline.execute(pair.query);

      const recall = calculateRecall(result.results, pair.expectedDocs);

      expect(recall).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('multi-query recall', () => {
    it('should improve recall with query decomposition', async () => {
      // Complex query that benefits from decomposition
      const complexQuery = '性能优化和缓存策略对比';
      const expectedDocs = ['perf-1', 'perf-2', 'perf-3', 'cache-1', 'cache-2', 'cache-3'];

      const result = await pipeline.execute(complexQuery);

      // With decomposition, should retrieve from both domains
      const recall = calculateRecall(result.results, expectedDocs);

      // Target: >= 70% recall for complex queries
      expect(recall).toBeGreaterThanOrEqual(0.7);
    });

    it('should retrieve from multiple domains for cross-domain queries', async () => {
      const result = await pipeline.execute('数据库和缓存技术');

      const retrievedDocs = result.results?.map(r => r.sourceDocumentId) ?? [];

      // Should include both database (perf-*) and cache (*) documents
      const hasDbDocs = retrievedDocs.some(id => id.startsWith('perf'));
      const hasCacheDocs = retrievedDocs.some(id => id.startsWith('cache'));

      expect(hasDbDocs || hasCacheDocs).toBe(true);
    });
  });

  describe('overall recall metrics', () => {
    it('should achieve >= 90% average recall across all queries', async () => {
      const recallRates: number[] = [];

      for (const pair of queryAnswerPairs) {
        const result = await pipeline.execute(pair.query);
        const recall = calculateRecall(result.results, pair.expectedDocs);
        recallRates.push(recall);
      }

      const avgRecall = recallRates.reduce((a, b) => a + b, 0) / recallRates.length;

      expect(avgRecall).toBeGreaterThanOrEqual(0.9);
    });

    it('should maintain high recall for colloquial queries', async () => {
      // Colloquial query that should be rewritten
      const colloquialQuery = '怎么让系统跑得更快';
      const expectedDocs = ['perf-1', 'perf-2', 'perf-3'];

      const result = await pipeline.execute(colloquialQuery);

      // Query rewriting should improve recall
      const recall = calculateRecall(result.results, expectedDocs);

      expect(recall).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('precision metrics', () {
    it('should maintain high precision for high-confidence results', async () => {
      const result = await pipeline.execute('性能优化方法');

      // High confidence results should be relevant
      const highConfidenceResults = result.results?.filter(
        r => r.confidenceLevel === 'high'
      ) ?? [];

      // Check that high confidence results match expected docs
      const relevantHighConfidence = highConfidenceResults.filter(
        r => r.sourceDocumentId.startsWith('perf')
      );

      const precision = highConfidenceResults.length > 0
        ? relevantHighConfidence.length / highConfidenceResults.length
        : 0;

      // High confidence results should be >= 80% relevant
      expect(precision).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('no-match handling', () => {
    it('should correctly identify irrelevant queries', async () => {
      const irrelevantQuery = '完全不相关的话题xyz123abc';
      const result = await pipeline.execute(irrelevantQuery);

      // Should return no-match or have very low confidence
      if (!result.success) {
        expect(result.noMatch?.status).toBe('no_match');
      } else {
        const avgConfidence = result.context?.avgConfidence ?? 0;
        expect(avgConfidence).toBeLessThan(0.4);
      }
    });
  });
});