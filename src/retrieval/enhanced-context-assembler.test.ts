/**
 * EnhancedContextAssembler Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedContextAssembler, createEnhancedContextAssembler } from './enhanced-context-assembler.js';
import type { ConfidenceRetrievalResult, ContextWithConfidence } from './types.js';
import { createDefaultConfidenceResult } from './types.js';
import type { TopKResult } from './config.js';

describe('EnhancedContextAssembler', () => {
  let assembler: EnhancedContextAssembler;

  // Helper to create mock results
  const createMockResult = (
    content: string,
    confidence: number,
    page?: number
  ): ConfidenceRetrievalResult => {
    const result = createDefaultConfidenceResult({
      smallChunkId: 'chunk-1',
      parentChunkId: 'parent-1',
      smallChunkContent: content.slice(0, 50),
      parentChunkContent: content,
      similarityScore: confidence,
      sourceDocumentId: 'doc-1',
      metadata: { contentType: 'text', pageNumber: page },
      expandedFromSmallChunk: true,
    });
    return {
      ...result,
      confidenceScore: confidence,
      confidenceLevel: confidence >= 0.7 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
    };
  };

  // Default topK config
  const defaultTopK: TopKResult = {
    coarseTopK: 10,
    targetTokens: 4000,
    effectiveWindow: 51500,
  };

  beforeEach(() => {
    assembler = createEnhancedContextAssembler();
  });

  describe('assemble', () => {
    it('should assemble context from results', () => {
      const results = [
        createMockResult('高性能优化方案文档内容', 0.8, 1),
        createMockResult('系统架构设计文档', 0.6, 2),
      ];

      const context = assembler.assemble(results, defaultTopK);

      expect(context.chunks.length).toBeGreaterThan(0);
      expect(context.totalTokens).toBeGreaterThan(0);
    });

    it('should truncate when exceeding target tokens', () => {
      // Create results with large content
      const largeResults = [
        createMockResult('长内容'.repeat(500), 0.8), // ~1000 chars = ~250 tokens
        createMockResult('长内容'.repeat(500), 0.7),
        createMockResult('长内容'.repeat(500), 0.6),
      ];

      const smallTopK: TopKResult = {
        coarseTopK: 10,
        targetTokens: 300, // Small target to force truncation
        effectiveWindow: 500,
      };

      const context = assembler.assemble(largeResults, smallTopK);

      expect(context.truncated).toBe(true);
      expect(context.chunks.length).toBeLessThan(largeResults.length);
    });

    it('should preserve confidence metadata', () => {
      const results = [
        createMockResult('内容一', 0.8, 1),
        createMockResult('内容二', 0.5, 2),
      ];

      const context = assembler.assemble(results, defaultTopK);

      expect(context.chunks[0]?.confidence).toBe(0.8);
      expect(context.chunks[0]?.confidenceLevel).toBe('high');
      expect(context.chunks[1]?.confidenceLevel).toBe('medium');
    });

    it('should include source metadata', () => {
      const results = [createMockResult('内容', 0.8, 5)];

      const context = assembler.assemble(results, defaultTopK);

      expect(context.chunks[0]?.source).toBe('doc-1');
      expect(context.chunks[0]?.page).toBe(5);
    });
  });

  describe('assembleWithLimit', () => {
    it('should use custom token limit', () => {
      const results = [
        createMockResult('内容'.repeat(100), 0.8),
      ];

      const context = assembler.assembleWithLimit(results, 50);

      // Should be truncated if content exceeds 50 tokens
      expect(context.totalTokens).toBeLessThanOrEqual(50);
    });
  });

  describe('confidence level helpers', () => {
    it('should get confidence level for score', () => {
      expect(assembler.getConfidenceLevel(0.8)).toBe('high');
      expect(assembler.getConfidenceLevel(0.6)).toBe('medium');
      expect(assembler.getConfidenceLevel(0.3)).toBe('low');
    });

    it('should filter chunks by confidence', () => {
      const chunks: ContextWithConfidence[] = [
        { content: 'a', confidence: 0.8, confidenceLevel: 'high', source: 'doc' },
        { content: 'b', confidence: 0.5, confidenceLevel: 'medium', source: 'doc' },
        { content: 'c', confidence: 0.3, confidenceLevel: 'low', source: 'doc' },
      ];

      const filtered = assembler.filterByConfidence(chunks, 0.5);

      expect(filtered.length).toBe(2);
    });

    it('should get chunks by level', () => {
      const chunks: ContextWithConfidence[] = [
        { content: 'a', confidence: 0.8, confidenceLevel: 'high', source: 'doc' },
        { content: 'b', confidence: 0.5, confidenceLevel: 'medium', source: 'doc' },
        { content: 'c', confidence: 0.8, confidenceLevel: 'high', source: 'doc' },
      ];

      const highChunks = assembler.getChunksByLevel(chunks, 'high');

      expect(highChunks.length).toBe(2);
    });
  });

  describe('createContextString', () => {
    it('should create formatted context string', () => {
      const chunks: ContextWithConfidence[] = [
        { content: '内容一', confidence: 0.8, confidenceLevel: 'high', source: 'doc-1', page: 1 },
        { content: '内容二', confidence: 0.5, confidenceLevel: 'medium', source: 'doc-1' },
      ];

      const contextString = assembler.createContextString(chunks);

      expect(contextString).toContain('高置信度');
      expect(contextString).toContain('中置信度');
      expect(contextString).toContain('内容一');
      expect(contextString).toContain('内容二');
      expect(contextString).toContain('第1页');
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const results = [
        createMockResult('内容', 0.8),
        createMockResult('内容', 0.6),
        createMockResult('内容', 0.3),
      ];

      const context = assembler.assemble(results, defaultTopK);
      const stats = assembler.getStatistics(context);

      expect(stats.chunkCount).toBe(3);
      expect(stats.highCount).toBe(1);
      expect(stats.mediumCount).toBe(1);
      expect(stats.lowCount).toBe(1);
      expect(stats.avgConfidence).toBeGreaterThan(0);
    });

    it('should calculate utilization percent', () => {
      const context = assembler.assembleWithLimit([
        createMockResult('测试内容', 0.8),
      ], 100);

      const stats = assembler.getStatistics(context);

      expect(stats.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(stats.utilizationPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('validateContext', () => {
    it('should validate good context', () => {
      const results = [
        createMockResult('内容', 0.8),
        createMockResult('内容', 0.7),
      ];

      const context = assembler.assemble(results, defaultTopK);
      const validation = assembler.validateContext(context);

      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBe(0);
    });

    it('should warn on empty context', () => {
      const context = assembler.assemble([], defaultTopK);
      const validation = assembler.validateContext(context);

      expect(validation.warnings.some(w => w.includes('No chunks'))).toBe(true);
    });

    it('should warn on low average confidence', () => {
      const results = [
        createMockResult('内容', 0.1),
        createMockResult('内容', 0.2),
      ];

      const context = assembler.assemble(results, defaultTopK);
      const validation = assembler.validateContext(context);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on mostly low confidence chunks', () => {
      const results = [
        createMockResult('内容', 0.3),
        createMockResult('内容', 0.2),
        createMockResult('内容', 0.8),
      ];

      const context = assembler.assemble(results, defaultTopK);
      const validation = assembler.validateContext(context);

      expect(validation.warnings.some(w => w.includes('low confidence'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', () => {
      const context = assembler.assemble([], defaultTopK);

      expect(context.chunks.length).toBe(0);
      expect(context.totalTokens).toBe(0);
      expect(context.avgConfidence).toBe(0);
    });

    it('should handle single result', () => {
      const results = [createMockResult('单个内容', 0.7)];
      const context = assembler.assemble(results, defaultTopK);

      expect(context.chunks.length).toBe(1);
    });

    it('should handle zero target tokens', () => {
      const zeroTopK: TopKResult = {
        coarseTopK: 10,
        targetTokens: 0,
        effectiveWindow: 0,
      };

      const context = assembler.assemble([createMockResult('内容', 0.8)], zeroTopK);

      expect(context.chunks.length).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should return config', () => {
      const config = assembler.getConfig();
      expect(config.modelContextWindow).toBeDefined();
    });

    it('should use custom config', () => {
      assembler = createEnhancedContextAssembler({
        modelContextWindow: 32000,
      });

      const config = assembler.getConfig();
      expect(config.modelContextWindow).toBe(32000);
    });
  });
});