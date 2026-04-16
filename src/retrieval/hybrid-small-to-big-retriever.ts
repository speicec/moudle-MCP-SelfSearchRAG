/**
 * HybridSmallToBigRetriever - Dense + Sparse retrieval with Parent Expansion
 *
 * Search flow:
 * 1. Phase 1: Small Chunk Hybrid Search (Dense + Sparse on text_chunks)
 * 2. Phase 2: Parent Expansion (group by parentId, calculate parent scores)
 * 3. Phase 3: Fallback to Parent Sparse Index (if results insufficient)
 *
 * Features:
 * - Parallel Dense + Sparse search with RRF fusion
 * - Parent expansion for full context retrieval
 * - Fallback to parent_chunks sparse index
 */

import type { VectorStoreAdapter, SearchQuery, SearchResult, VectorPayload } from './vector-store-adapter.js';
import { COLLECTION_NAMES } from './vector-store-adapter.js';
import { rrfFusion, getFusionStats, type FusionResult, type FusionStats } from './rrf-fusion.js';
import type { HierarchicalStore } from '../chunking/hierarchical-store.js';
import type { HybridEmbeddingService } from '../embedding/hybrid-embedding-service.js';
import type { HybridRetrievalConfig } from '../config/vector-db-config.js';
import { DEFAULT_HYBRID_CONFIG } from '../config/vector-db-config.js';

/**
 * Hybrid search result with parent expansion
 */
export interface HybridSearchResult {
  /** Parent chunk ID */
  parentChunkId: string;
  /** Parent content (full context) */
  parentContent: string;
  /** Parent score (calculated from small chunks) */
  parentScore: number;
  /** Source method */
  method: 'hybrid_small' | 'fallback_parent_sparse';
  /** Small chunks that matched */
  matchedSmallChunks: SmallChunkMatch[];
  /** Fusion statistics */
  fusionInfo?: FusionInfo | undefined;
}

/**
 * Small chunk match information
 */
export interface SmallChunkMatch {
  smallChunkId: string;
  smallContent: string;
  score: number;
  sources: ('dense' | 'sparse')[];
  denseRank?: number | undefined;
  sparseRank?: number | undefined;
}

/**
 * Fusion information for hybrid search
 */
export interface FusionInfo {
  denseHits: number;
  sparseHits: number;
  overlapHits: number;
  fusedCount: number;
}

/**
 * Parent score calculation strategy
 */
export type ParentScoreStrategy = 'max' | 'avg' | 'weighted';

/**
 * Hybrid retriever configuration
 */
export interface HybridRetrieverConfig {
  /** Minimum results threshold for fallback trigger */
  minResults: number;
  /** Parent score calculation strategy */
  parentScoreStrategy: ParentScoreStrategy;
  /** Timeout for parallel search (ms) */
  searchTimeoutMs: number;
  /** Hybrid retrieval config */
  hybrid: HybridRetrievalConfig;
}

/**
 * Default hybrid retriever configuration
 */
export const DEFAULT_HYBRID_RETRIEVER_CONFIG: HybridRetrieverConfig = {
  minResults: 5,
  parentScoreStrategy: 'max',
  searchTimeoutMs: 30000,
  hybrid: DEFAULT_HYBRID_CONFIG,
};

/**
 * HybridSmallToBigRetriever class
 */
export class HybridSmallToBigRetriever {
  private vectorStore: VectorStoreAdapter;
  private hierarchicalStore: HierarchicalStore;
  private hybridEmbedding: HybridEmbeddingService;
  private config: HybridRetrieverConfig;

  constructor(
    vectorStore: VectorStoreAdapter,
    hierarchicalStore: HierarchicalStore,
    hybridEmbedding: HybridEmbeddingService,
    config?: Partial<HybridRetrieverConfig>
  ) {
    this.vectorStore = vectorStore;
    this.hierarchicalStore = hierarchicalStore;
    this.hybridEmbedding = hybridEmbedding;
    this.config = { ...DEFAULT_HYBRID_RETRIEVER_CONFIG, ...config };
  }

  /**
   * Perform hybrid search with parent expansion
   */
  async searchHybrid(
    query: string,
    topK: number,
    filter?: any
  ): Promise<HybridSearchResult[]> {
    console.log(`[HybridRetriever] Starting hybrid search for: "${query}" (topK: ${topK})`);

    // Step 1: Generate query embeddings
    const queryEmbedding = await this.hybridEmbedding.embedHybrid(query);

    // Step 2: Phase 1 - Small Chunk Hybrid Search
    const smallResults = await this.searchSmallChunksHybrid(queryEmbedding, topK * 2, filter);

    // Step 3: Parent Expansion
    const expandedResults = await this.expandToParents(smallResults);

    // Step 4: Check if results are sufficient
    if (expandedResults.length >= this.config.minResults) {
      console.log(`[HybridRetriever] Got ${expandedResults.length} parent results from small hybrid search`);
      return expandedResults.map(r => ({
        ...r,
        method: 'hybrid_small' as const,
      }));
    }

    // Step 5: Phase 3 - Fallback to Parent Sparse Index
    console.log(`[HybridRetriever] Insufficient results (${expandedResults.length}), triggering fallback to parent sparse`);
    const fallbackResults = await this.fallbackSearchParentSparse(queryEmbedding.sparse, topK, filter);

    return fallbackResults.map(r => ({
      ...r,
      method: 'fallback_parent_sparse' as const,
    }));
  }

  /**
   * Phase 1: Small Chunk Hybrid Search (Dense + Sparse)
   */
  private async searchSmallChunksHybrid(
    queryEmbedding: { dense: number[]; sparse: any },
    topK: number,
    filter?: any
  ): Promise<FusionResult[]> {
    const rrfConfig = this.config.hybrid.rrf;

    // Parallel Dense + Sparse search
    const searchPromise = Promise.all([
      // Dense search
      this.vectorStore.searchDense(COLLECTION_NAMES.TEXT_CHUNKS, {
        vector: queryEmbedding.dense,
        topK: rrfConfig.denseTopK,
        filter,
      }),
      // Sparse search
      this.vectorStore.searchSparse(COLLECTION_NAMES.TEXT_CHUNKS, {
        sparseVector: queryEmbedding.sparse,
        topK: rrfConfig.sparseTopK,
        filter,
      }),
    ]);

    // Add timeout
    const timeoutPromise = new Promise<[SearchResult[], SearchResult[]]>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), this.config.searchTimeoutMs);
    });

    const [denseResults, sparseResults] = await Promise.race([searchPromise, timeoutPromise]);

    // RRF Fusion
    const fusedResults = rrfFusion(denseResults, sparseResults, rrfConfig.k);
    const fusionStats = getFusionStats(denseResults, sparseResults, fusedResults);

    console.log(`[HybridRetriever] Small hybrid search: dense=${fusionStats.denseInputCount}, sparse=${fusionStats.sparseInputCount}, overlap=${fusionStats.overlapCount}, fused=${fusionStats.fusedCount}`);

    return fusedResults.slice(0, topK);
  }

  /**
   * Phase 2: Parent Expansion
   */
  private async expandToParents(smallResults: FusionResult[]): Promise<HybridSearchResult[]> {
    // Group by parentId
    const parentGroups = this.groupByParent(smallResults);

    // Calculate parent scores
    const parentScores = this.calculateParentScores(parentGroups);

    // Fetch parent content from HierarchicalStore
    const expandedResults: HybridSearchResult[] = [];

    for (const [parentId, scoreInfo] of parentScores) {
      const parentChunk = this.hierarchicalStore.getChunk(parentId);
      if (!parentChunk) {
        console.warn(`[HybridRetriever] Parent chunk not found: ${parentId}`);
        continue;
      }

      // Collect matched small chunks info
      const matchedSmallChunks: SmallChunkMatch[] = [];
      for (const smallResult of scoreInfo.smallResults) {
        const smallChunk = this.hierarchicalStore.getChunk(smallResult.id);
        if (smallChunk) {
          matchedSmallChunks.push({
            smallChunkId: smallResult.id,
            smallContent: smallChunk.content,
            score: smallResult.score,
            sources: smallResult.sources,
            denseRank: smallResult.denseRank,
            sparseRank: smallResult.sparseRank,
          });
        }
      }

      expandedResults.push({
        parentChunkId: parentId,
        parentContent: parentChunk.content,
        parentScore: scoreInfo.score,
        method: 'hybrid_small', // Will be set by caller
        matchedSmallChunks,
        fusionInfo: {
          denseHits: scoreInfo.smallResults.filter(r => r.sources.includes('dense')).length,
          sparseHits: scoreInfo.smallResults.filter(r => r.sources.includes('sparse')).length,
          overlapHits: scoreInfo.smallResults.filter(r => r.sources.includes('dense') && r.sources.includes('sparse')).length,
          fusedCount: scoreInfo.smallResults.length,
        },
      });
    }

    // Sort by parent score descending
    expandedResults.sort((a, b) => b.parentScore - a.parentScore);

    return expandedResults;
  }

  /**
   * Group small chunk results by parentId
   */
  private groupByParent(smallResults: FusionResult[]): Map<string, FusionResult[]> {
    const groups = new Map<string, FusionResult[]>();

    for (const result of smallResults) {
      if (!result.payload) continue;

      const parentId = result.payload.parentId as string;
      if (!parentId) {
        // Small chunk without parent - use its own ID as fallback
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

  /**
   * Calculate parent scores from grouped small results
   */
  private calculateParentScores(
    parentGroups: Map<string, FusionResult[]>
  ): Map<string, { score: number; smallResults: FusionResult[] }> {
    const scores = new Map<string, { score: number; smallResults: FusionResult[] }>();

    for (const [parentId, smallResults] of parentGroups) {
      const score = this.computeParentScore(smallResults, this.config.parentScoreStrategy);
      scores.set(parentId, { score, smallResults });
    }

    return scores;
  }

  /**
   * Compute parent score from small chunk scores
   */
  private computeParentScore(smallResults: FusionResult[], strategy: ParentScoreStrategy): number {
    if (smallResults.length === 0) return 0;

    switch (strategy) {
      case 'max':
        return Math.max(...smallResults.map(r => r.score));

      case 'avg':
        const sum = smallResults.reduce((acc, r) => acc + r.score, 0);
        return sum / smallResults.length;

      case 'weighted':
        // Weighted: avg * (1 + log(matchCount))
        const avgScore = smallResults.reduce((acc, r) => acc + r.score, 0) / smallResults.length;
        const matchBonus = 1 + Math.log(smallResults.length);
        return avgScore * matchBonus;

      default:
        return Math.max(...smallResults.map(r => r.score));
    }
  }

  /**
   * Phase 3: Fallback to Parent Sparse Index
   */
  private async fallbackSearchParentSparse(
    querySparse: any,
    topK: number,
    filter?: any
  ): Promise<HybridSearchResult[]> {
    // Search parent_chunks collection using sparse only
    const parentResults = await this.vectorStore.searchSparse(COLLECTION_NAMES.PARENT_CHUNKS, {
      sparseVector: querySparse,
      topK: this.config.hybrid.rrf.fallbackTopK,
      filter,
    });

    console.log(`[HybridRetriever] Fallback parent sparse search: ${parentResults.length} results`);

    // Fetch parent content from HierarchicalStore
    const expandedResults: HybridSearchResult[] = [];

    for (const result of parentResults) {
      const parentChunk = this.hierarchicalStore.getChunk(result.id);
      if (!parentChunk) {
        console.warn(`[HybridRetriever] Parent chunk not found in fallback: ${result.id}`);
        continue;
      }

      expandedResults.push({
        parentChunkId: result.id,
        parentContent: parentChunk.content,
        parentScore: result.score,
        method: 'fallback_parent_sparse', // Will be set by caller
        matchedSmallChunks: [], // No small chunks in fallback
        fusionInfo: undefined,
      });
    }

    expandedResults.sort((a, b) => b.parentScore - a.parentScore);
    return expandedResults.slice(0, topK);
  }

  /**
   * Get configuration
   */
  getConfig(): HybridRetrieverConfig {
    return { ...this.config };
  }
}

/**
 * Create hybrid small-to-big retriever
 */
export function createHybridSmallToBigRetriever(
  vectorStore: VectorStoreAdapter,
  hierarchicalStore: HierarchicalStore,
  hybridEmbedding: HybridEmbeddingService,
  config?: Partial<HybridRetrieverConfig>
): HybridSmallToBigRetriever {
  return new HybridSmallToBigRetriever(vectorStore, hierarchicalStore, hybridEmbedding, config);
}