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
import type { HierarchicalChunk } from '../chunking/types.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';
import type { HybridEmbeddingService } from '../embedding/hybrid-embedding-service.js';
import type { HybridRetrievalConfig } from '../config/vector-db-config.js';
import { DEFAULT_HYBRID_CONFIG, DEFAULT_PAYLOAD_STORAGE_CONFIG } from '../config/vector-db-config.js';

/**
 * Hybrid search result with parent expansion
 */
export interface HybridSearchResult {
  /** Parent chunk ID */
  parentChunkId: string;
  /** Parent content (full context) */
  parentContent: string;
  /** Parent score (calculated from small chunks - RRF score for sorting) */
  parentScore: number;
  /** Semantic similarity score (max Dense Cosine score for display) */
  semanticScore?: number;
  /** Source method */
  method: 'hybrid_small' | 'fallback_parent_sparse';
  /** Small chunks that matched */
  matchedSmallChunks: SmallChunkMatch[];
  /** Fusion statistics */
  fusionInfo?: FusionInfo | undefined;
  /** Recovery source if chunk was recovered from Qdrant */
  recoveredFrom?: 'qdrant_payload' | undefined;
  /** Recovery status */
  recoveryStatus?: 'success' | 'partial' | 'failed' | undefined;
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
   * Recover chunk from Qdrant payload when HierarchicalStore is missing data
   * This is the fallback mechanism for data inconsistency scenarios
   *
   * @param chunkId - The chunk ID to recover
   * @returns Recovered chunk or null if recovery failed
   */
  private async recoverFromQdrant(chunkId: string): Promise<HierarchicalChunk | undefined> {
    if (!DEFAULT_PAYLOAD_STORAGE_CONFIG.storeContentInPayload) {
      console.warn(`[HybridRetriever] Recovery attempted for ${chunkId} but STORE_CONTENT_IN_PAYLOAD is disabled`);
      return undefined;
    }

    try {
      // Try to get from TEXT_CHUNKS collection first (for small chunks)
      let point = await this.vectorStore.getPoint(COLLECTION_NAMES.TEXT_CHUNKS, chunkId);

      // If not found, try PARENT_CHUNKS (for parent chunks)
      if (!point) {
        point = await this.vectorStore.getPoint(COLLECTION_NAMES.PARENT_CHUNKS, chunkId);
      }

      if (!point || !point.payload) {
        console.warn(`[HybridRetriever] Recovery failed: point ${chunkId} not found in Qdrant`);
        return undefined;
      }

      const payload = point.payload;

      // Check if content is available in payload
      if (!payload.content) {
        console.warn(`[HybridRetriever] Recovery partial: point ${chunkId} found but no content in payload`);
        return undefined;
      }

      // Create a recovered chunk from payload
      const metadata: import('../chunking/types.js').ChunkMetadata = {
        contentType: (payload.contentType as 'text' | 'table' | 'image' | 'formula') ?? 'text',
        boundaryConfidence: 0.5, // Default for recovered chunks
        ...(payload.pageNumber !== undefined ? { pageNumber: payload.pageNumber } : {}),
        // Document-level metadata for GRADE evaluation
        ...(payload.documentYear !== undefined ? { documentYear: payload.documentYear } : {}),
        ...(payload.documentTitle !== undefined ? { documentTitle: payload.documentTitle } : {}),
        ...(payload.documentAuthor !== undefined ? { documentAuthor: payload.documentAuthor } : {}),
        ...(payload.guidelineSource !== undefined ? { guidelineSource: payload.guidelineSource } : {}),
      };

      const recoveredChunk = createHierarchicalChunk(
        payload.content,
        [], // Empty embedding - stored in Qdrant
        payload.level as 'small' | 'parent',
        payload.position ?? { start: 0, end: payload.content.length },
        payload.documentId,
        {
          composite: payload.qualityScore ?? 0.5,
          dimensions: {
            informationDensity: 0.5,
            repetitionRatio: 0.5,
            semanticCompleteness: 0.5,
            documentRelevance: 0.5,
          },
          evaluatedAt: new Date(),
        },
        metadata,
        payload.parentId ?? undefined,
        payload.childIds
      );

      // Use the original chunk ID instead of generating new one
      recoveredChunk.id = chunkId;

      // Add recovered chunk to HierarchicalStore temporarily
      this.hierarchicalStore.addChunk(recoveredChunk);

      console.log(`[HybridRetriever] Recovery success: chunk ${chunkId} recovered from Qdrant payload`);

      return recoveredChunk;
    } catch (error) {
      console.error(`[HybridRetriever] Recovery failed for ${chunkId}:`, error);
      return undefined;
    }
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
   * Includes fallback recovery from Qdrant when HierarchicalStore is missing data
   */
  private async expandToParents(smallResults: FusionResult[]): Promise<HybridSearchResult[]> {
    // Group by parentId
    const parentGroups = this.groupByParent(smallResults);

    // Calculate parent scores
    const parentScores = this.calculateParentScores(parentGroups);

    // Fetch parent content from HierarchicalStore
    const expandedResults: HybridSearchResult[] = [];

    for (const [parentId, scoreInfo] of parentScores) {
      let parentChunk = this.hierarchicalStore.getChunk(parentId);
      let recoveryStatus: 'success' | 'partial' | 'failed' | undefined = undefined;
      let recoveredFrom: 'qdrant_payload' | undefined = undefined;

      // Fallback: Try to recover from Qdrant if parent chunk not found
      if (!parentChunk) {
        console.warn(`[HybridRetriever] Parent chunk not found in store: ${parentId}, attempting recovery from Qdrant`);
        parentChunk = await this.recoverFromQdrant(parentId);

        if (parentChunk) {
          recoveryStatus = 'success';
          recoveredFrom = 'qdrant_payload';
          console.log(`[HybridRetriever] Recovery event: success for parent ${parentId}`);
        } else {
          recoveryStatus = 'failed';
          console.warn(`[HybridRetriever] Recovery event: failed for parent ${parentId}, skipping result`);
          continue; // Skip this result if recovery failed
        }
      }

      // Collect matched small chunks info
      const matchedSmallChunks: SmallChunkMatch[] = [];
      for (const smallResult of scoreInfo.smallResults) {
        let smallChunk = this.hierarchicalStore.getChunk(smallResult.id);

        // Fallback: Try to recover small chunk from Qdrant if not found
        if (!smallChunk) {
          smallChunk = await this.recoverFromQdrant(smallResult.id);
          if (smallChunk) {
            console.log(`[HybridRetriever] Recovery event: success for small chunk ${smallResult.id}`);
          }
        }

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
        ...(scoreInfo.semanticScore !== undefined ? { semanticScore: scoreInfo.semanticScore } : {}),
        method: 'hybrid_small', // Will be set by caller
        matchedSmallChunks,
        recoveredFrom,
        recoveryStatus,
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
  ): Map<string, { score: number; semanticScore?: number; smallResults: FusionResult[] }> {
    const scores = new Map<string, { score: number; semanticScore?: number; smallResults: FusionResult[] }>();

    for (const [parentId, smallResults] of parentGroups) {
      const score = this.computeParentScore(smallResults, this.config.parentScoreStrategy);
      const semanticScore = this.computeSemanticScore(smallResults);
      scores.set(parentId, {
        score,
        ...(semanticScore !== undefined ? { semanticScore } : {}),
        smallResults,
      });
    }

    return scores;
  }

  /**
   * Compute semantic score as max(denseScore) for frontend display
   * Returns undefined if no dense matches (sparse-only results)
   */
  private computeSemanticScore(smallResults: FusionResult[]): number | undefined {
    const denseScores = smallResults
      .filter(r => r.denseScore !== undefined)
      .map(r => r.denseScore!);

    if (denseScores.length === 0) {
      return undefined; // No dense matches - sparse only
    }

    return Math.max(...denseScores);
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
      let parentChunk = this.hierarchicalStore.getChunk(result.id);
      let recoveryStatus: 'success' | 'partial' | 'failed' | undefined = undefined;
      let recoveredFrom: 'qdrant_payload' | undefined = undefined;

      // Fallback: Try to recover from Qdrant if parent chunk not found
      if (!parentChunk) {
        console.warn(`[HybridRetriever] Parent chunk not found in fallback: ${result.id}, attempting recovery from Qdrant`);
        parentChunk = await this.recoverFromQdrant(result.id);

        if (parentChunk) {
          recoveryStatus = 'success';
          recoveredFrom = 'qdrant_payload';
          console.log(`[HybridRetriever] Recovery event: success for parent ${result.id} in fallback`);
        } else {
          recoveryStatus = 'failed';
          console.warn(`[HybridRetriever] Recovery event: failed for parent ${result.id} in fallback, skipping result`);
          continue; // Skip this result if recovery failed
        }
      }

      expandedResults.push({
        parentChunkId: result.id,
        parentContent: parentChunk.content,
        parentScore: result.score,
        method: 'fallback_parent_sparse', // Will be set by caller
        matchedSmallChunks: [], // No small chunks in fallback
        recoveredFrom,
        recoveryStatus,
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