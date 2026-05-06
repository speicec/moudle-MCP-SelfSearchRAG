/**
 * RRF Fusion Tests - Score Preservation
 *
 * Tests for verifying that original Dense/Sparse scores are preserved
 * during RRF fusion for frontend display.
 */

import { describe, it, expect } from 'vitest';
import { rrfFusion, type FusionResult } from './rrf-fusion.js';
import type { SearchResult } from './vector-store-adapter.js';

describe('RRF Fusion Score Preservation', () => {
  /**
   * Create mock search result with score
   */
  function createMockResult(id: string, score: number): SearchResult {
    return {
      id,
      score,
      payload: {
        documentId: 'doc-1',
        chunkId: id,
        level: 'small',
        modality: 'text',
        parentId: `parent-${id}`,
      },
    };
  }

  describe('Dense score preservation', () => {
    it('should preserve dense Cosine score in FusionResult', () => {
      const denseResults = [
        createMockResult('chunk-1', 0.85), // Cosine similarity
        createMockResult('chunk-2', 0.72),
      ];
      const sparseResults = [];

      const fused = rrfFusion(denseResults, sparseResults, 60);

      expect(fused.length).toBe(2);
      expect(fused[0]?.denseScore).toBe(0.85);
      expect(fused[0]?.sources).toContain('dense');
      expect(fused[1]?.denseScore).toBe(0.72);
    });

    it('should preserve dense score when result appears in both dense and sparse', () => {
      const denseResults = [
        createMockResult('chunk-1', 0.90),
      ];
      const sparseResults = [
        createMockResult('chunk-1', 15.5), // BM25 score (different scale)
      ];

      const fused = rrfFusion(denseResults, sparseResults, 60);

      expect(fused.length).toBe(1);
      expect(fused[0]?.denseScore).toBe(0.90);
      expect(fused[0]?.sparseScore).toBe(15.5);
      expect(fused[0]?.sources).toEqual(['dense', 'sparse']);
    });
  });

  describe('Sparse score preservation', () => {
    it('should preserve sparse BM25 score in FusionResult', () => {
      const denseResults = [];
      const sparseResults = [
        createMockResult('chunk-1', 12.5), // BM25 score
        createMockResult('chunk-2', 8.3),
      ];

      const fused = rrfFusion(denseResults, sparseResults, 60);

      expect(fused.length).toBe(2);
      expect(fused[0]?.sparseScore).toBe(12.5);
      expect(fused[0]?.sources).toContain('sparse');
      expect(fused[1]?.sparseScore).toBe(8.3);
    });
  });

  describe('RRF ranking unchanged', () => {
    it('should still use rank-based formula for fused score', () => {
      const denseResults = [
        createMockResult('chunk-1', 0.99), // High Cosine score but rank 1
        createMockResult('chunk-2', 0.01), // Low Cosine score but rank 2
      ];
      const sparseResults = [];

      const fused = rrfFusion(denseResults, sparseResults, 60);

      // RRF score should be based on rank, not Cosine score
      // Rank 1: 1/(60+1) ≈ 0.0164
      // Rank 2: 1/(60+2) ≈ 0.0161
      expect(fused[0]?.score).toBeCloseTo(1/61, 4);
      expect(fused[1]?.score).toBeCloseTo(1/62, 4);

      // But denseScore preserves the original values
      expect(fused[0]?.denseScore).toBe(0.99);
      expect(fused[1]?.denseScore).toBe(0.01);
    });

    it('should sort by RRF score, not by denseScore', () => {
      // Dense has high Cosine at rank 2
      // Sparse has lower BM25 at rank 1
      const denseResults = [
        createMockResult('chunk-a', 0.10), // rank 1
        createMockResult('chunk-b', 0.95), // rank 2 (high Cosine but later rank)
      ];
      const sparseResults = [
        createMockResult('chunk-c', 5.0), // rank 1 in sparse
      ];

      const fused = rrfFusion(denseResults, sparseResults, 60);

      // chunk-a has RRF score 1/61 ≈ 0.0164
      // chunk-b has RRF score 1/62 ≈ 0.0161
      // chunk-c has RRF score 1/61 ≈ 0.0164
      // So chunk-a and chunk-c should be near top, chunk-b lower
      // (exact order depends on RRF algorithm)

      // Verify ordering is by RRF score
      for (let i = 0; i < fused.length - 1; i++) {
        expect(fused[i]?.score).toBeGreaterThanOrEqual(fused[i + 1]?.score ?? 0);
      }
    });
  });

  describe('Hybrid results', () => {
    it('should correctly merge dense and sparse with both scores', () => {
      const denseResults = [
        createMockResult('overlap', 0.88),
        createMockResult('dense-only', 0.75),
      ];
      const sparseResults = [
        createMockResult('overlap', 10.2),
        createMockResult('sparse-only', 3.5),
      ];

      const fused = rrfFusion(denseResults, sparseResults, 60);

      // Find overlap result
      const overlap = fused.find(r => r.id === 'overlap');
      expect(overlap?.denseScore).toBe(0.88);
      expect(overlap?.sparseScore).toBe(10.2);
      expect(overlap?.sources).toEqual(['dense', 'sparse']);

      // Find dense-only result
      const denseOnly = fused.find(r => r.id === 'dense-only');
      expect(denseOnly?.denseScore).toBe(0.75);
      expect(denseOnly?.sparseScore).toBeUndefined();
      expect(denseOnly?.sources).toEqual(['dense']);

      // Find sparse-only result
      const sparseOnly = fused.find(r => r.id === 'sparse-only');
      expect(sparseOnly?.denseScore).toBeUndefined();
      expect(sparseOnly?.sparseScore).toBe(3.5);
      expect(sparseOnly?.sources).toEqual(['sparse']);
    });
  });
});