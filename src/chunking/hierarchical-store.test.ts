/**
 * HierarchicalStore Token Statistics Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HierarchicalStore } from './hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from './types.js';

describe('HierarchicalStore Token Statistics', () => {
  let store: HierarchicalStore;

  beforeEach(() => {
    store = new HierarchicalStore();
  });

  describe('getAvgParentTokenLength', () => {
    it('should return default 800 when no parent chunks', () => {
      const avg = store.getAvgParentTokenLength();
      expect(avg).toBe(800);
    });

    it('should calculate average for single parent chunk', async () => {
      // Create a parent chunk with ~400 chars (~100 tokens)
      const parent = createHierarchicalChunk(
        '这是一个测试内容，大约有400个字符的长度，用于测试token统计功能是否正常工作。',
        [],
        'parent',
        { start: 0, end: 100 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      store.addChunk(parent);

      const avg = store.getAvgParentTokenLength();
      expect(avg).toBeGreaterThan(0);
      expect(avg).toBeLessThan(200);
    });

    it('should calculate average for multiple parent chunks', async () => {
      // Create multiple parent chunks
      const parent1 = createHierarchicalChunk(
        '第一个父块内容，长度适中。',
        [],
        'parent',
        { start: 0, end: 50 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const parent2 = createHierarchicalChunk(
        '第二个父块内容，稍微长一些，包含更多的文本信息用于测试。',
        [],
        'parent',
        { start: 50, end: 100 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      store.addChunk(parent1);
      store.addChunk(parent2);

      const avg = store.getAvgParentTokenLength();
      expect(avg).toBeGreaterThan(0);
    });
  });

  describe('getTokenStats', () => {
    it('should return zeros when no chunks', () => {
      const stats = store.getTokenStats();

      expect(stats.avgSmallTokens).toBe(0);
      expect(stats.avgParentTokens).toBe(0);
      expect(stats.minParentTokens).toBe(0);
      expect(stats.maxParentTokens).toBe(0);
      expect(stats.totalParentTokens).toBe(0);
    });

    it('should return correct statistics for mixed chunks', async () => {
      // Create small chunks
      const small1 = createHierarchicalChunk(
        '小块内容1',
        [],
        'small',
        { start: 0, end: 20 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' },
        'parent-1'
      );

      const small2 = createHierarchicalChunk(
        '小块内容2，稍长',
        [],
        'small',
        { start: 20, end: 40 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' },
        'parent-1'
      );

      // Create parent chunks
      const parent1 = createHierarchicalChunk(
        '父块内容一',
        [],
        'parent',
        { start: 0, end: 50 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' },
        undefined,
        [small1.id, small2.id]
      );

      const parent2 = createHierarchicalChunk(
        '父块内容二，比较长的内容块用于测试',
        [],
        'parent',
        { start: 50, end: 100 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      store.addChunk(small1);
      store.addChunk(small2);
      store.addChunk(parent1);
      store.addChunk(parent2);

      const stats = store.getTokenStats();

      expect(stats.avgSmallTokens).toBeGreaterThan(0);
      expect(stats.avgParentTokens).toBeGreaterThan(0);
      expect(stats.minParentTokens).toBeLessThanOrEqual(stats.maxParentTokens);
      expect(stats.totalParentTokens).toBeGreaterThan(0);
    });
  });

  describe('integration with chunking', () => {
    it('should work after building hierarchy', async () => {
      // Create small chunks
      const smallChunks = [
        createHierarchicalChunk(
          '小块内容一',
          [],
          'small',
          { start: 0, end: 20 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          '小块内容二',
          [],
          'small',
          { start: 20, end: 40 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      // Build hierarchy
      await store.buildHierarchy(smallChunks, 'doc-1');

      // Check token stats
      const avg = store.getAvgParentTokenLength();
      expect(avg).toBeGreaterThan(0);

      const stats = store.getTokenStats();
      expect(stats.avgParentTokens).toBeGreaterThan(0);
    });
  });
});