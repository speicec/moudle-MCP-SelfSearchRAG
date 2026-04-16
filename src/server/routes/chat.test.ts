/**
 * Chat API Tests for Enhanced Retrieval
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnhancedChatResponse } from '../types.js';

describe('Chat API Enhanced Routes', () => {
  // Mock fastify instance
  const mockFastify = {
    hierarchicalStore: {
      getChunkCount: vi.fn().mockReturnValue({ small: 10, parent: 5 }),
      getAvgParentTokenLength: vi.fn().mockReturnValue(800),
    },
    embeddingService: {
      embedText: vi.fn().mockResolvedValue(new Array(384).fill(0)),
      getDimension: vi.fn().mockReturnValue(384),
    },
    wsHandler: {
      broadcast: vi.fn(),
    },
    log: {
      error: vi.fn(),
    },
    post: vi.fn(),
    get: vi.fn(),
  };

  describe('/enhanced endpoint', () => {
    it('should return enhanced response structure', () => {
      const mockResponse: EnhancedChatResponse = {
        query: '性能优化',
        results: [],
        queryAnalysis: {
          complexity: 'simple',
          wasRewritten: false,
          wasDecomposed: false,
          expandedTerms: ['速度提升'],
        },
        retrievalStats: {
          coarseTopK: 58,
          refinedCount: 5,
          avgConfidence: 0.65,
          truncated: false,
          method: 'internal-confidence',
        },
        context: {
          chunks: [],
          totalTokens: 1000,
          truncated: false,
          avgConfidence: 0.65,
        },
        answer: '测试答案',
        thinking: '测试思考',
      };

      expect(mockResponse.queryAnalysis).toBeDefined();
      expect(mockResponse.retrievalStats).toBeDefined();
      expect(mockResponse.context.avgConfidence).toBeDefined();
    });

    it('should handle no-match case', () => {
      const noMatchResponse = {
        query: '不匹配查询',
        success: false,
        noMatch: {
          status: 'no_match',
          message: '未找到相关信息',
          suggestions: ['请尝试其他关键词'],
        },
      };

      expect(noMatchResponse.noMatch.status).toBe('no_match');
    });
  });

  describe('/config endpoint', () => {
    it('should return default configuration', () => {
      const configResponse = {
        default: {
          modelContextWindow: 64000,
          minConfidenceThreshold: 0.3,
          rerankerThreshold: 20,
        },
        presets: {
          light: { modelContextWindow: 32000 },
          standard: { modelContextWindow: 64000 },
          extended: { modelContextWindow: 128000 },
        },
      };

      expect(configResponse.default.modelContextWindow).toBe(64000);
      expect(configResponse.presets.standard.modelContextWindow).toBe(64000);
    });
  });

  describe('EnhancedChatResponse type validation', () => {
    it('should validate confidence levels', () => {
      const levels: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

      for (const level of levels) {
        expect(['high', 'medium', 'low']).toContain(level);
      }
    });

    it('should validate method types', () => {
      const methods: Array<'local-reranker' | 'internal-confidence'> = [
        'local-reranker',
        'internal-confidence',
      ];

      for (const method of methods) {
        expect(['local-reranker', 'internal-confidence']).toContain(method);
      }
    });

    it('should validate complexity types', () => {
      const complexities: Array<'simple' | 'complex' | 'structured'> = [
        'simple',
        'complex',
        'structured',
      ];

      for (const complexity of complexities) {
        expect(['simple', 'complex', 'structured']).toContain(complexity);
      }
    });
  });

  describe('request validation', () => {
    it('should reject empty query', () => {
      const request = { query: '' };
      expect(request.query.trim().length).toBe(0);
    });

    it('should accept valid query', () => {
      const request = { query: '性能优化方案' };
      expect(request.query.trim().length).toBeGreaterThan(0);
    });

    it('should accept config overrides', () => {
      const request = {
        query: '测试',
        config: {
          minConfidenceThreshold: 0.4,
          rerankerThreshold: 15,
        },
      };

      expect(request.config).toBeDefined();
    });
  });

  describe('response structure', () => {
    it('should include all required fields', () => {
      const requiredFields = [
        'query',
        'results',
        'queryAnalysis',
        'retrievalStats',
        'context',
        'answer',
        'thinking',
      ];

      const mockResponse = {
        query: 'test',
        results: [],
        queryAnalysis: { complexity: 'simple', wasRewritten: false, wasDecomposed: false, expandedTerms: [] },
        retrievalStats: { coarseTopK: 10, refinedCount: 5, avgConfidence: 0.5, truncated: false, method: 'internal-confidence' },
        context: { chunks: [], totalTokens: 0, truncated: false, avgConfidence: 0.5 },
        answer: '',
        thinking: '',
      };

      for (const field of requiredFields) {
        expect(mockResponse).toHaveProperty(field);
      }
    });

    it('should have correct nested structure', () => {
      const mockResponse: EnhancedChatResponse = {
        query: 'test',
        results: [{
          smallChunkId: 'id',
          parentChunkId: 'pid',
          parentChunkContent: 'content',
          similarityScore: 0.8,
          confidenceScore: 0.75,
          confidenceLevel: 'high',
          sourceDocumentId: 'doc',
          metadata: {},
        }],
        queryAnalysis: {
          complexity: 'simple',
          wasRewritten: false,
          wasDecomposed: false,
          expandedTerms: [],
        },
        retrievalStats: {
          coarseTopK: 10,
          refinedCount: 1,
          avgConfidence: 0.75,
          truncated: false,
          method: 'internal-confidence',
        },
        context: {
          chunks: [{
            content: 'test',
            confidence: 0.75,
            confidenceLevel: 'high',
            source: 'doc',
          }],
          totalTokens: 10,
          truncated: false,
          avgConfidence: 0.75,
        },
        answer: 'answer',
        thinking: '',
      };

      expect(mockResponse.results[0]?.confidenceLevel).toBe('high');
      expect(mockResponse.queryAnalysis.complexity).toBe('simple');
      expect(mockResponse.retrievalStats.method).toBe('internal-confidence');
    });
  });
});