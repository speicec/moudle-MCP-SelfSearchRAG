import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rrfFusion,
  getFusionStats,
  countOverlap,
  normalizeFusionScores,
  filterByThreshold,
  getOverlapResults,
  getDenseOnlyResults,
  getSparseOnlyResults,
  FusionResult,
  SearchResult,
} from '../retrieval/rrf-fusion.js';

// Mock data for testing
const mockDenseResults: SearchResult[] = [
  { id: 'chunk1', score: 0.95, payload: { parentId: 'parent1' } },
  { id: 'chunk2', score: 0.90, payload: { parentId: 'parent1' } },
  { id: 'chunk3', score: 0.85, payload: { parentId: 'parent2' } },
  { id: 'chunk4', score: 0.80, payload: { parentId: 'parent2' } },
  { id: 'chunk5', score: 0.75, payload: { parentId: 'parent3' } },
];

const mockSparseResults: SearchResult[] = [
  { id: 'chunk2', score: 0.88, payload: { parentId: 'parent1' } }, // Overlap with dense
  { id: 'chunk3', score: 0.82, payload: { parentId: 'parent2' } }, // Overlap with dense
  { id: 'chunk6', score: 0.78, payload: { parentId: 'parent1' } }, // New result
  { id: 'chunk7', score: 0.72, payload: { parentId: 'parent4' } }, // New result
  { id: 'chunk8', score: 0.65, payload: { parentId: 'parent4' } }, // New result
];

describe('RRF Fusion', () => {
  describe('rrfFusion', () => {
    it('should combine dense and sparse results correctly', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      expect(fused.length).toBeGreaterThan(0);
      expect(fused.length).toBeLessThanOrEqual(mockDenseResults.length + mockSparseResults.length);
    });

    it('should assign correct RRF scores', () => {
      // For k=60, rank 1 score = 1/61 ≈ 0.0164
      // rank 2 score = 1/62 ≈ 0.0161
      // chunk2 appears in both dense (rank 2) and sparse (rank 1)
      // score = 1/62 + 1/61 ≈ 0.0325
      const fused = rrfFusion(mockDenseResults.slice(0, 2), mockSparseResults.slice(0, 2), 60);

      // Top result should be chunk2 (overlap) with combined score
      expect(fused[0].id).toBe('chunk2');
      expect(fused[0].score).toBeCloseTo(1/61 + 1/62, 4); // ≈ 0.0325
    });

    it('should mark overlapping results with both sources', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      const overlap = fused.find(r => r.id === 'chunk2');
      expect(overlap).toBeDefined();
      expect(overlap!.sources).toContain('dense');
      expect(overlap!.sources).toContain('sparse');
    });

    it('should mark dense-only results', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      const denseOnly = fused.find(r => r.id === 'chunk1');
      expect(denseOnly).toBeDefined();
      expect(denseOnly!.sources).toContain('dense');
      expect(denseOnly!.sources).not.toContain('sparse');
    });

    it('should mark sparse-only results', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      const sparseOnly = fused.find(r => r.id === 'chunk7');
      expect(sparseOnly).toBeDefined();
      expect(sparseOnly!.sources).not.toContain('dense');
      expect(sparseOnly!.sources).toContain('sparse');
    });

    it('should assign rank information', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      // chunk1 is rank 1 in dense
      const chunk1 = fused.find(r => r.id === 'chunk1');
      expect(chunk1!.denseRank).toBe(1);

      // chunk7 is rank 4 in sparse
      const chunk7 = fused.find(r => r.id === 'chunk7');
      expect(chunk7!.sparseRank).toBe(4);
    });

    it('should sort by fused score descending', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      for (let i = 0; i < fused.length - 1; i++) {
        expect(fused[i].score).toBeGreaterThanOrEqual(fused[i + 1].score);
      }
    });

    it('should handle empty dense results', () => {
      const fused = rrfFusion([], mockSparseResults, 60);

      expect(fused.length).toBe(mockSparseResults.length);
      expect(fused.every(r => r.sources.includes('sparse'))).toBe(true);
    });

    it('should handle empty sparse results', () => {
      const fused = rrfFusion(mockDenseResults, [], 60);

      expect(fused.length).toBe(mockDenseResults.length);
      expect(fused.every(r => r.sources.includes('dense'))).toBe(true);
    });

    it('should handle both empty results', () => {
      const fused = rrfFusion([], [], 60);

      expect(fused.length).toBe(0);
    });

    it('should use different k values correctly', () => {
      const fusedK60 = rrfFusion(mockDenseResults.slice(0, 1), [], 60);
      const fusedK10 = rrfFusion(mockDenseResults.slice(0, 1), [], 10);

      // With smaller k, scores should be higher
      expect(fusedK10[0].score).toBeGreaterThan(fusedK60[0].score);
    });

    it('should preserve payload', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);

      const chunk1 = fused.find(r => r.id === 'chunk1');
      expect(chunk1!.payload).toEqual({ parentId: 'parent1' });
    });
  });

  describe('getFusionStats', () => {
    it('should return correct statistics', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const stats = getFusionStats(mockDenseResults, mockSparseResults, fused);

      expect(stats.denseInputCount).toBe(5);
      expect(stats.sparseInputCount).toBe(5);
      expect(stats.fusedCount).toBeLessThanOrEqual(10);
    });

    it('should count overlapping results', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const stats = getFusionStats(mockDenseResults, mockSparseResults, fused);

      // chunk2 and chunk3 are overlapping
      expect(stats.overlapCount).toBe(2);
    });

    it('should handle empty results', () => {
      const fused = rrfFusion([], [], 60);
      const stats = getFusionStats([], [], fused);

      expect(stats.denseInputCount).toBe(0);
      expect(stats.sparseInputCount).toBe(0);
      expect(stats.fusedCount).toBe(0);
      expect(stats.overlapCount).toBe(0);
    });
  });

  describe('countOverlap', () => {
    it('should count overlapping IDs', () => {
      const overlap = countOverlap(mockDenseResults, mockSparseResults);

      expect(overlap).toBe(2); // chunk2 and chunk3
    });

    it('should return 0 for no overlap', () => {
      const denseOnly: SearchResult[] = [{ id: 'a', score: 0.9 }, { id: 'b', score: 0.8 }];
      const sparseOnly: SearchResult[] = [{ id: 'c', score: 0.9 }, { id: 'd', score: 0.8 }];

      const overlap = countOverlap(denseOnly, sparseOnly);

      expect(overlap).toBe(0);
    });
  });

  describe('normalizeFusionScores', () => {
    it('should normalize scores to [0, 1]', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const normalized = normalizeFusionScores(fused);

      expect(normalized.every(r => r.score >= 0 && r.score <= 1)).toBe(true);
      expect(normalized[0].score).toBe(1); // Max should be 1
    });

    it('should handle empty results', () => {
      const normalized = normalizeFusionScores([]);

      expect(normalized.length).toBe(0);
    });

    it('should handle single result', () => {
      const single: FusionResult[] = [{ id: 'test', score: 0.5, sources: ['dense'] }];
      const normalized = normalizeFusionScores(single);

      expect(normalized.length).toBe(1);
      // Single result with same min/max should stay unchanged
    });
  });

  describe('filterByThreshold', () => {
    it('should filter results below threshold', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const threshold = fused[fused.length - 1].score + 0.001;
      const filtered = filterByThreshold(fused, threshold);

      expect(filtered.length).toBeLessThan(fused.length);
      expect(filtered.every(r => r.score >= threshold)).toBe(true);
    });

    it('should keep all results with low threshold', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const filtered = filterByThreshold(fused, 0);

      expect(filtered.length).toBe(fused.length);
    });

    it('should return empty with high threshold', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const filtered = filterByThreshold(fused, 100);

      expect(filtered.length).toBe(0);
    });
  });

  describe('getOverlapResults', () => {
    it('should return results from both dense and sparse', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const overlap = getOverlapResults(fused);

      expect(overlap.every(r => r.sources.includes('dense') && r.sources.includes('sparse'))).toBe(true);
    });
  });

  describe('getDenseOnlyResults', () => {
    it('should return results only from dense', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const denseOnly = getDenseOnlyResults(fused);

      expect(denseOnly.every(r => r.sources.includes('dense') && !r.sources.includes('sparse'))).toBe(true);
    });
  });

  describe('getSparseOnlyResults', () => {
    it('should return results only from sparse', () => {
      const fused = rrfFusion(mockDenseResults, mockSparseResults, 60);
      const sparseOnly = getSparseOnlyResults(fused);

      expect(sparseOnly.every(r => !r.sources.includes('dense') && r.sources.includes('sparse'))).toBe(true);
    });
  });
});

describe('Parent Score Calculation', () => {
  // Helper functions matching HybridSmallToBigRetriever logic

  function computeParentScoreMax(smallResults: FusionResult[]): number {
    if (smallResults.length === 0) return 0;
    return Math.max(...smallResults.map(r => r.score));
  }

  function computeParentScoreAvg(smallResults: FusionResult[]): number {
    if (smallResults.length === 0) return 0;
    const sum = smallResults.reduce((acc, r) => acc + r.score, 0);
    return sum / smallResults.length;
  }

  function computeParentScoreWeighted(smallResults: FusionResult[]): number {
    if (smallResults.length === 0) return 0;
    const avgScore = smallResults.reduce((acc, r) => acc + r.score, 0) / smallResults.length;
    const matchBonus = 1 + Math.log(smallResults.length);
    return avgScore * matchBonus;
  }

  function groupByParent(smallResults: FusionResult[]): Map<string, FusionResult[]> {
    const groups = new Map<string, FusionResult[]>();

    for (const result of smallResults) {
      const parentId = result.payload?.parentId as string;
      if (!parentId) {
        groups.set(result.id, [result]);
        continue;
      }

      if (!groups.has(parentId)) {
        groups.set(parentId, []);
      }
      groups.get(parentId)!.push(result);
    }

    return groups;
  }

  describe('computeParentScoreMax', () => {
    it('should return max score', () => {
      const results: FusionResult[] = [
        { id: 'a', score: 0.5, sources: ['dense'] },
        { id: 'b', score: 0.8, sources: ['sparse'] },
        { id: 'c', score: 0.3, sources: ['dense', 'sparse'] },
      ];

      expect(computeParentScoreMax(results)).toBe(0.8);
    });

    it('should return 0 for empty results', () => {
      expect(computeParentScoreMax([])).toBe(0);
    });
  });

  describe('computeParentScoreAvg', () => {
    it('should return average score', () => {
      const results: FusionResult[] = [
        { id: 'a', score: 0.5, sources: ['dense'] },
        { id: 'b', score: 0.8, sources: ['sparse'] },
        { id: 'c', score: 0.3, sources: ['dense', 'sparse'] },
      ];

      expect(computeParentScoreAvg(results)).toBeCloseTo(0.533, 2);
    });

    it('should return 0 for empty results', () => {
      expect(computeParentScoreAvg([])).toBe(0);
    });
  });

  describe('computeParentScoreWeighted', () => {
    it('should apply match bonus', () => {
      const results: FusionResult[] = [
        { id: 'a', score: 0.5, sources: ['dense'] },
        { id: 'b', score: 0.5, sources: ['sparse'] },
      ];

      // avg = 0.5, matchCount = 2, bonus = 1 + log(2) ≈ 1.69
      // weighted = 0.5 * 1.69 ≈ 0.845
      expect(computeParentScoreWeighted(results)).toBeCloseTo(0.5 * (1 + Math.log(2)), 3);
    });

    it('should increase score with more matches', () => {
      const twoResults: FusionResult[] = [
        { id: 'a', score: 0.5, sources: ['dense'] },
        { id: 'b', score: 0.5, sources: ['sparse'] },
      ];
      const fiveResults: FusionResult[] = [
        { id: 'a', score: 0.5, sources: ['dense'] },
        { id: 'b', score: 0.5, sources: ['sparse'] },
        { id: 'c', score: 0.5, sources: ['dense'] },
        { id: 'd', score: 0.5, sources: ['sparse'] },
        { id: 'e', score: 0.5, sources: ['dense'] },
      ];

      expect(computeParentScoreWeighted(fiveResults)).toBeGreaterThan(computeParentScoreWeighted(twoResults));
    });

    it('should return 0 for empty results', () => {
      expect(computeParentScoreWeighted([])).toBe(0);
    });
  });

  describe('groupByParent', () => {
    it('should group results by parentId', () => {
      const results: FusionResult[] = [
        { id: 'chunk1', score: 0.5, sources: ['dense'], payload: { parentId: 'parent1' } },
        { id: 'chunk2', score: 0.8, sources: ['sparse'], payload: { parentId: 'parent1' } },
        { id: 'chunk3', score: 0.3, sources: ['dense'], payload: { parentId: 'parent2' } },
      ];

      const groups = groupByParent(results);

      expect(groups.size).toBe(2);
      expect(groups.get('parent1')!.length).toBe(2);
      expect(groups.get('parent2')!.length).toBe(1);
    });

    it('should handle results without parentId', () => {
      const results: FusionResult[] = [
        { id: 'chunk1', score: 0.5, sources: ['dense'] }, // No payload
        { id: 'chunk2', score: 0.8, sources: ['sparse'], payload: { parentId: 'parent1' } },
      ];

      const groups = groupByParent(results);

      expect(groups.size).toBe(2);
      expect(groups.has('chunk1')).toBe(true); // Uses own ID as fallback
    });

    it('should handle empty results', () => {
      const groups = groupByParent([]);

      expect(groups.size).toBe(0);
    });
  });
});