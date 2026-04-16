/**
 * RRF Fusion - Reciprocal Rank Fusion algorithm
 *
 * Combines Dense and Sparse search results using RRF:
 * score = Σ 1/(k + rank_i)
 *
 * Benefits:
 * - No score normalization needed
 * - Robust to different score scales
 * - Simple and effective
 */

import type { SearchResult } from './vector-store-adapter.js';

/**
 * Fusion result with rank information
 */
export interface FusionResult {
  /** Chunk/document ID */
  id: string;
  /** Fused score */
  score: number;
  /** Original dense rank (if present) */
  denseRank?: number;
  /** Original sparse rank (if present) */
  sparseRank?: number;
  /** Search sources that matched this result */
  sources: ('dense' | 'sparse')[];
  /** Original search result payload */
  payload?: any;
}

/**
 * Fusion statistics
 */
export interface FusionStats {
  /** Number of dense results input */
  denseInputCount: number;
  /** Number of sparse results input */
  sparseInputCount: number;
  /** Number of unique results after fusion */
  fusedCount: number;
  /** Number of results that appeared in both dense and sparse */
  overlapCount: number;
}

/**
 * RRF fusion configuration
 */
export interface RRFConfig {
  /** RRF k parameter (default: 60) */
  k: number;
}

/**
 * Default RRF configuration
 */
export const DEFAULT_RRF_CONFIG: RRFConfig = {
  k: 60,
};

/**
 * Perform Reciprocal Rank Fusion on dense and sparse results
 *
 * @param denseResults Results from dense vector search
 * @param sparseResults Results from sparse vector search
 * @param k RRF parameter (default: 60)
 * @returns Fused results sorted by combined score
 */
export function rrfFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  k: number = DEFAULT_RRF_CONFIG.k
): FusionResult[] {
  const scoreMap = new Map<string, FusionResult>();

  // Process dense results
  for (let i = 0; i < denseResults.length; i++) {
    const result = denseResults[i];
    if (!result) continue;

    const rank = i + 1; // Rank starts at 1
    const rrfScore = 1 / (k + rank);

    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.score += rrfScore;
      existing.denseRank = rank;
      existing.sources.push('dense');
    } else {
      scoreMap.set(result.id, {
        id: result.id,
        score: rrfScore,
        denseRank: rank,
        sources: ['dense'],
        payload: result.payload,
      });
    }
  }

  // Process sparse results
  for (let i = 0; i < sparseResults.length; i++) {
    const result = sparseResults[i];
    if (!result) continue;

    const rank = i + 1;
    const rrfScore = 1 / (k + rank);

    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.score += rrfScore;
      existing.sparseRank = rank;
      existing.sources.push('sparse');
    } else {
      scoreMap.set(result.id, {
        id: result.id,
        score: rrfScore,
        sparseRank: rank,
        sources: ['sparse'],
        payload: result.payload,
      });
    }
  }

  // Sort by fused score descending
  const fusedResults = Array.from(scoreMap.values());
  fusedResults.sort((a, b) => b.score - a.score);

  return fusedResults;
}

/**
 * Get fusion statistics
 */
export function getFusionStats(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  fusedResults: FusionResult[]
): FusionStats {
  const overlapCount = fusedResults.filter(
    r => r.sources.includes('dense') && r.sources.includes('sparse')
  ).length;

  return {
    denseInputCount: denseResults.length,
    sparseInputCount: sparseResults.length,
    fusedCount: fusedResults.length,
    overlapCount,
  };
}

/**
 * Count overlapping results between dense and sparse
 */
export function countOverlap(
  denseResults: SearchResult[],
  sparseResults: SearchResult[]
): number {
  const denseIds = new Set(denseResults.map(r => r.id));
  const sparseIds = new Set(sparseResults.map(r => r.id));

  let overlap = 0;
  for (const id of denseIds) {
    if (sparseIds.has(id)) {
      overlap++;
    }
  }

  return overlap;
}

/**
 * Normalize fusion scores to [0, 1] range
 */
export function normalizeFusionScores(results: FusionResult[]): FusionResult[] {
  if (results.length === 0) return results;

  const maxScore = Math.max(...results.map(r => r.score));
  const minScore = Math.min(...results.map(r => r.score));

  if (maxScore === minScore) {
    // All scores are equal, return as-is
    return results;
  }

  return results.map(r => ({
    ...r,
    score: (r.score - minScore) / (maxScore - minScore),
  }));
}

/**
 * Filter fusion results by threshold
 */
export function filterByThreshold(
  results: FusionResult[],
  threshold: number
): FusionResult[] {
  return results.filter(r => r.score >= threshold);
}

/**
 * Get results that appeared in both dense and sparse (overlap)
 */
export function getOverlapResults(results: FusionResult[]): FusionResult[] {
  return results.filter(
    r => r.sources.includes('dense') && r.sources.includes('sparse')
  );
}

/**
 * Get results that only appeared in dense search
 */
export function getDenseOnlyResults(results: FusionResult[]): FusionResult[] {
  return results.filter(
    r => r.sources.includes('dense') && !r.sources.includes('sparse')
  );
}

/**
 * Get results that only appeared in sparse search
 */
export function getSparseOnlyResults(results: FusionResult[]): FusionResult[] {
  return results.filter(
    r => !r.sources.includes('dense') && r.sources.includes('sparse')
  );
}