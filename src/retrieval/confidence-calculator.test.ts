/**
 * ConfidenceCalculator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceCalculator, createConfidenceCalculator } from './confidence-calculator.js';
import type { ConfidenceRetrievalResult } from './types.js';
import { createDefaultConfidenceResult } from './types.js';

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  // Helper to create mock results
  const createMockResult = (
    similarity: number,
    content: string,
    position: number = 0,
    quality: number = 0.5
  ): ConfidenceRetrievalResult => {
    return {
      ...createDefaultConfidenceResult({
        smallChunkId: `chunk-${position}`,
        parentChunkId: `parent-${position}`,
        smallChunkContent: content.slice(0, 50),
        parentChunkContent: content,
        similarityScore: similarity,
        sourceDocumentId: 'doc-1',
        metadata: { contentType: 'text', boundaryConfidence: quality },
        expandedFromSmallChunk: true,
      }),
      chunkQualityScore: quality,
    };
  };

  beforeEach(() => {
    calculator = createConfidenceCalculator();
  });

  describe('calculate', () => {
    it('should calculate scores for multiple results', () => {
      const results = [
        createMockResult(0.8, '性能优化方案包括响应时间提升', 0, 0.7),
        createMockResult(0.6, '系统架构设计文档', 1, 0.6),
        createMockResult(0.4, '数据分析报告内容', 2, 0.5),
      ];

      const scores = calculator.calculate('性能优化', results);

      expect(scores).toHaveLength(3);
      expect(scores[0]).toBeGreaterThan(scores[1]);
      expect(scores[1]).toBeGreaterThan(scores[2]);
    });

    it('should return scores in valid range [0, 1]', () => {
      const results = [
        createMockResult(0.9, '高相似度内容', 0, 0.8),
        createMockResult(0.1, '低相似度内容', 1, 0.2),
      ];

      const scores = calculator.calculate('测试查询', results);

      expect(scores[0]).toBeGreaterThanOrEqual(0);
      expect(scores[0]).toBeLessThanOrEqual(1);
      expect(scores[1]).toBeGreaterThanOrEqual(0);
      expect(scores[1]).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateAndApply', () => {
    it('should apply scores to results', () => {
      const results = [
        createMockResult(0.8, '性能优化内容', 0),
      ];

      const applied = calculator.calculateAndApply('性能优化', results);

      expect(applied[0]?.confidenceScore).toBeDefined();
      expect(applied[0]?.confidenceLevel).toBeDefined();
    });

    it('should set correct confidence levels', () => {
      // Position affects score: position=0 gets highest score
      // To get medium level (>=0.5), need sufficient similarity + position contribution
      const highResult = createMockResult(0.9, '高匹配测试内容', 0, 0.9);
      const mediumResult = createMockResult(0.7, '中等匹配测试', 0, 0.6);
      const lowResult = createMockResult(0.35, '低匹配内容', 1, 0.3);

      const applied = calculator.calculateAndApply('测试', [highResult, mediumResult, lowResult]);

      expect(applied[0]?.confidenceLevel).toBe('high');
      expect(applied[1]?.confidenceLevel).toBe('medium');
      expect(applied[2]?.confidenceLevel).toBe('low');
    });
  });

  describe('similarity score component', () => {
    it('should weight similarity score correctly', () => {
      calculator = createConfidenceCalculator({
        confidenceWeights: { similarity: 1, keywordMatch: 0, position: 0, chunkQuality: 0 },
      });

      const result = createMockResult(0.7, '测试内容', 0, 0);
      const scores = calculator.calculate('测试', [result]);

      // With only similarity weight, score should match similarity
      expect(scores[0]).toBeCloseTo(0.7, 1);
    });
  });

  describe('keyword match score', () => {
    it('should score keyword matches', () => {
      const matchingResult = createMockResult(0.5, '性能优化响应时间', 0);
      const nonMatchingResult = createMockResult(0.5, '完全无关内容', 1);

      const scores = calculator.calculate('性能优化', [matchingResult, nonMatchingResult]);

      // Matching result should have higher score due to keyword overlap
      expect(scores[0]).toBeGreaterThan(scores[1]);
    });

    it('should handle Chinese keywords', () => {
      const result = createMockResult(0.5, '向量数据库检索系统', 0);
      const scores = calculator.calculate('向量数据库', [result]);

      expect(scores[0]).toBeGreaterThan(0);
    });
  });

  describe('position score', () => {
    it('should give higher score to earlier positions', () => {
      calculator = createConfidenceCalculator({
        confidenceWeights: { similarity: 0, keywordMatch: 0, position: 1, chunkQuality: 0 },
      });

      const results = [
        createMockResult(0.5, '相同内容', 0),
        createMockResult(0.5, '相同内容', 1),
        createMockResult(0.5, '相同内容', 2),
      ];

      const scores = calculator.calculate('测试', results);

      expect(scores[0]).toBeGreaterThan(scores[1]);
      expect(scores[1]).toBeGreaterThan(scores[2]);
    });

    it('should give position 0 score of 1.0', () => {
      calculator = createConfidenceCalculator({
        confidenceWeights: { similarity: 0, keywordMatch: 0, position: 1, chunkQuality: 0 },
      });

      const result = createMockResult(0, '', 0);
      const scores = calculator.calculate('测试', [result]);

      expect(scores[0]).toBe(1);
    });
  });

  describe('chunk quality score', () => {
    it('should weight chunk quality correctly', () => {
      calculator = createConfidenceCalculator({
        confidenceWeights: { similarity: 0, keywordMatch: 0, position: 0, chunkQuality: 1 },
      });

      const highQuality = createMockResult(0.5, '内容', 0, 0.9);
      const lowQuality = createMockResult(0.5, '内容', 1, 0.3);

      const scores = calculator.calculate('测试', [highQuality, lowQuality]);

      expect(scores[0]).toBeGreaterThan(scores[1]);
    });

    it('should use boundary confidence as fallback', () => {
      calculator = createConfidenceCalculator({
        confidenceWeights: { similarity: 0, keywordMatch: 0, position: 0, chunkQuality: 1 },
      });

      const result = createMockResult(0.5, '内容', 0, 0);
      result.chunkQualityScore = 0;
      result.metadata.boundaryConfidence = 0.7;

      const scores = calculator.calculate('测试', [result]);

      expect(scores[0]).toBeCloseTo(0.7, 1);
    });
  });

  describe('sortByConfidence', () => {
    it('should sort results by confidence descending', () => {
      const results = [
        { ...createMockResult(0.3, '低', 2), confidenceScore: 0.3, confidenceLevel: 'low' as const },
        { ...createMockResult(0.8, '高', 0), confidenceScore: 0.8, confidenceLevel: 'high' as const },
        { ...createMockResult(0.5, '中', 1), confidenceScore: 0.5, confidenceLevel: 'medium' as const },
      ];

      const sorted = calculator.sortByConfidence(results);

      expect(sorted[0]?.confidenceScore).toBe(0.8);
      expect(sorted[1]?.confidenceScore).toBe(0.5);
      expect(sorted[2]?.confidenceScore).toBe(0.3);
    });
  });

  describe('getAverageConfidence', () => {
    it('should calculate average confidence', () => {
      const results = [
        { ...createMockResult(0.8, '', 0), confidenceScore: 0.8, confidenceLevel: 'high' as const },
        { ...createMockResult(0.6, '', 1), confidenceScore: 0.6, confidenceLevel: 'medium' as const },
        { ...createMockResult(0.4, '', 2), confidenceScore: 0.4, confidenceLevel: 'low' as const },
      ];

      const avg = calculator.getAverageConfidence(results);

      expect(avg).toBeCloseTo(0.6, 1);
    });

    it('should return 0 for empty results', () => {
      const avg = calculator.getAverageConfidence([]);
      expect(avg).toBe(0);
    });
  });

  describe('getConfidenceDistribution', () => {
    it('should return distribution statistics', () => {
      const results = [
        { ...createMockResult(0.8, '', 0), confidenceScore: 0.8, confidenceLevel: 'high' as const },
        { ...createMockResult(0.6, '', 1), confidenceScore: 0.6, confidenceLevel: 'medium' as const },
        { ...createMockResult(0.6, '', 2), confidenceScore: 0.6, confidenceLevel: 'medium' as const },
        { ...createMockResult(0.3, '', 3), confidenceScore: 0.3, confidenceLevel: 'low' as const },
      ];

      const dist = calculator.getConfidenceDistribution(results);

      expect(dist.high).toBe(1);
      expect(dist.medium).toBe(2);
      expect(dist.low).toBe(1);
      expect(dist.avg).toBeCloseTo(0.575, 1);
    });
  });

  describe('weights configuration', () => {
    it('should return default weights', () => {
      const weights = calculator.getWeights();

      expect(weights.similarity).toBe(0.5);
      expect(weights.keywordMatch).toBe(0.2);
      expect(weights.position).toBe(0.1);
      expect(weights.chunkQuality).toBe(0.2);
    });

    it('should allow custom weights', () => {
      calculator.setWeights({ similarity: 0.6, keywordMatch: 0.3, position: 0.05, chunkQuality: 0.05 });
      const weights = calculator.getWeights();

      expect(weights.similarity).toBe(0.6);
      expect(weights.keywordMatch).toBe(0.3);
    });

    it('should reject weights not summing to 1', () => {
      expect(() => calculator.setWeights({ similarity: 0.8 })).toThrow('must sum to 1');
    });
  });

  describe('caching', () => {
    it('should cache query keywords', () => {
      const results = [createMockResult(0.5, '性能优化', 0)];

      // First call
      calculator.calculate('性能优化', results);

      // Second call with same query should use cache
      calculator.calculate('性能优化', results);

      // Cache should exist
      calculator.clearCache();
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', () => {
      const scores = calculator.calculate('测试', []);
      expect(scores).toHaveLength(0);
    });

    it('should handle single result', () => {
      const result = createMockResult(0.5, '内容', 0);
      const scores = calculator.calculate('测试', [result]);

      expect(scores).toHaveLength(1);
      expect(scores[0]).toBeGreaterThan(0);
    });

    it('should handle results with empty content', () => {
      const result = createMockResult(0.5, '', 0);
      const scores = calculator.calculate('测试', [result]);

      expect(scores).toHaveLength(1);
    });
  });
});