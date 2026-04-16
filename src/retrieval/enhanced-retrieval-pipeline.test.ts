/**
 * EnhancedRetrievalPipeline Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedRetrievalPipeline, createEnhancedRetrievalPipeline } from './enhanced-retrieval-pipeline.js';
import type { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import type { HierarchicalStore } from '../chunking/hierarchical-store.js';
import type { ConfidenceRetrievalResult } from './types.js';
import { createDefaultConfidenceResult, determineConfidenceLevel } from './types.js';

describe('EnhancedRetrievalPipeline', () => {
  let pipeline: EnhancedRetrievalPipeline;

  // Mock retriever
  const createMockRetriever = (): SmallToBigRetriever => {
    return {
      retrieveMultiQueryWithConfidence: vi.fn().mockImplementation(async (queries: string[]) => {
        // Return mock results
        return queries.map((_, i) => {
          const result = createDefaultConfidenceResult({
            smallChunkId: `chunk-${i}`,
            parentChunkId: `parent-${i}`,
            smallChunkContent: `内容${i}`,
            parentChunkContent: `性能优化文档内容${i}`,
            similarityScore: 0.6 + i * 0.05,
            sourceDocumentId: 'doc-1',
            metadata: { contentType: 'text' },
            expandedFromSmallChunk: true,
          });
          return {
            ...result,
            confidenceScore: 0.6 + i * 0.05,
            confidenceLevel: determineConfidenceLevel(0.6 + i * 0.05),
          };
        });
      }),
    } as unknown as SmallToBigRetriever;
  };

  // Mock store
  const createMockStore = (): HierarchicalStore => {
    return {
      getAvgParentTokenLength: vi.fn().mockReturnValue(800),
    } as unknown as HierarchicalStore;
  };

  // Mock LLM caller
  const mockLLMCaller = vi.fn().mockImplementation(async (prompt: string) => {
    // Return mock analysis JSON
    if (prompt.includes('分析')) {
      return JSON.stringify({
        complexity: 'simple',
        needsDecomposition: false,
        needsRewrite: false,
        detectedFilters: {},
        suggestedSubQueries: [],
      });
    }
    return '重写后的查询';
  });

  beforeEach(async () => {
    pipeline = createEnhancedRetrievalPipeline({}, mockLLMCaller);
    pipeline.setRetriever(createMockRetriever());
    pipeline.setStore(createMockStore());
    await pipeline.initialize();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const newPipeline = createEnhancedRetrievalPipeline();
      await newPipeline.initialize();

      const status = newPipeline.getStatus();
      expect(status.initialized).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute full pipeline', async () => {
      const result = await pipeline.execute('性能优化方案');

      expect(result.success).toBe(true);
      expect(result.query).toBe('性能优化方案');
      expect(result.stats).toBeDefined();
      expect(result.stats?.totalTime).toBeGreaterThan(0);
    });

    it('should return analysis result', async () => {
      const result = await pipeline.execute('测试查询');

      expect(result.analysis).toBeDefined();
      expect(result.analysis?.complexity).toBeDefined();
    });

    it('should return optimization output', async () => {
      const result = await pipeline.execute('性能优化');

      expect(result.optimization).toBeDefined();
      expect(result.optimization?.originalQuery).toBe('性能优化');
      expect(result.optimization?.expandedTerms).toBeDefined();
    });

    it('should return topK config', async () => {
      const result = await pipeline.execute('测试');

      expect(result.topKConfig).toBeDefined();
      expect(result.topKConfig?.coarseTopK).toBeGreaterThan(0);
      expect(result.topKConfig?.targetTokens).toBeGreaterThan(0);
    });

    it('should return ranked results', async () => {
      const result = await pipeline.execute('性能优化');

      expect(result.results).toBeDefined();
      expect(result.results?.length).toBeGreaterThan(0);
    });

    it('should return assembled context', async () => {
      const result = await pipeline.execute('性能优化');

      expect(result.context).toBeDefined();
      expect(result.context?.chunks.length).toBeGreaterThan(0);
      expect(result.context?.avgConfidence).toBeGreaterThan(0);
    });

    it('should handle low confidence results', async () => {
      // Mock retriever returning low confidence results
      const lowConfidenceRetriever = {
        retrieveMultiQueryWithConfidence: vi.fn().mockResolvedValue([
          {
            ...createDefaultConfidenceResult({
              smallChunkId: 'chunk-1',
              parentChunkId: 'parent-1',
              smallChunkContent: '内容',
              parentChunkContent: '内容',
              similarityScore: 0.1,
              sourceDocumentId: 'doc-1',
              metadata: { contentType: 'text' },
              expandedFromSmallChunk: true,
            }),
            confidenceScore: 0.1,
            confidenceLevel: 'low',
          },
        ]),
      } as unknown as SmallToBigRetriever;

      pipeline.setRetriever(lowConfidenceRetriever);
      const result = await pipeline.execute('不匹配的查询');

      expect(result.success).toBe(false);
      expect(result.noMatch).toBeDefined();
      expect(result.noMatch?.status).toBe('no_match');
    });

    it('should return error when retriever not configured', async () => {
      const newPipeline = createEnhancedRetrievalPipeline();
      await newPipeline.initialize();

      const result = await newPipeline.execute('测试');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Retriever not configured');
    });
  });

  describe('pipeline stages', () => {
    it('should execute query analysis', async () => {
      const result = await pipeline.execute('性能优化');

      expect(result.analysis?.complexity).toBeDefined();
    });

    it('should execute query expansion', async () => {
      const result = await pipeline.execute('性能优化');

      // Expansion should return some terms
      expect(result.optimization?.expandedTerms).toBeDefined();
    });

    it('should execute dynamic topK calculation', async () => {
      const result = await pipeline.execute('测试');

      expect(result.topKConfig?.coarseTopK).toBeGreaterThan(0);
    });

    it('should execute reranking', async () => {
      const result = await pipeline.execute('测试');

      expect(result.stats?.method).toBeDefined();
      expect(result.results?.length).toBeGreaterThan(0);
    });

    it('should execute context assembly', async () => {
      const result = await pipeline.execute('测试');

      expect(result.context?.chunks.length).toBeGreaterThan(0);
      expect(result.context?.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('stats tracking', () => {
    it('should track analysis time', async () => {
      const result = await pipeline.execute('测试');

      expect(result.stats?.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it('should track retrieval time', async () => {
      const result = await pipeline.execute('测试');

      expect(result.stats?.retrievalTime).toBeGreaterThanOrEqual(0);
    });

    it('should track reranking time', async () => {
      const result = await pipeline.execute('测试');

      expect(result.stats?.rerankingTime).toBeGreaterThanOrEqual(0);
    });

    it('should track total time', async () => {
      const result = await pipeline.execute('测试');

      expect(result.stats?.totalTime).toBeGreaterThan(0);
      expect(result.stats?.totalTime).toBeGreaterThanOrEqual(
        result.stats?.analysisTime +
        result.stats?.retrievalTime +
        result.stats?.rerankingTime +
        result.stats?.assemblyTime
      );
    });
  });

  describe('getStatus', () => {
    it('should return pipeline status', () => {
      const status = pipeline.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.rerankerReady).toBeDefined();
      expect(status.config).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown pipeline', async () => {
      await pipeline.shutdown();

      const status = pipeline.getStatus();
      expect(status.rerankerReady).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should return config', () => {
      const config = pipeline.getConfig();

      expect(config.modelContextWindow).toBeDefined();
      expect(config.minConfidenceThreshold).toBeDefined();
    });

    it('should use custom config', async () => {
      const customPipeline = createEnhancedRetrievalPipeline({
        minConfidenceThreshold: 0.4,
        rerankerThreshold: 15,
      });

      await customPipeline.initialize();
      const config = customPipeline.getConfig();

      expect(config.minConfidenceThreshold).toBe(0.4);
      expect(config.rerankerThreshold).toBe(15);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const result = await pipeline.execute('');

      expect(result).toBeDefined();
    });

    it('should handle very long query', async () => {
      const longQuery = '这是一个非常长的查询内容，包含多个关键词和复杂问题';
      const result = await pipeline.execute(longQuery);

      expect(result).toBeDefined();
    });

    it('should handle special characters', async () => {
      const result = await pipeline.execute('查询@#$%特殊字符');

      expect(result).toBeDefined();
    });
  });
});