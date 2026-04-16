import type {
  HierarchicalChunk,
  HierarchicalRetrievalResult,
  AssembledContext,
} from './types.js';
import type { SmallToBigRetrievalConfig, ContextWindowConfig } from './config.js';
import { DEFAULT_RETRIEVAL_CONFIG, DEFAULT_CONTEXT_WINDOW_CONFIG } from './config.js';
import { HierarchicalStore } from './hierarchical-store.js';
import { cosineSimilarity, sortBySimilarity } from './utils.js';
import type { ConfidenceRetrievalResult } from '../retrieval/types.js';
import { createDefaultConfidenceResult, determineConfidenceLevel } from '../retrieval/types.js';
import type { HybridSmallToBigRetriever, HybridSearchResult } from '../retrieval/hybrid-small-to-big-retriever.js';

/**
 * Query cache for embedding reuse
 */
class QueryCache {
  private cache: Map<string, { embedding: number[]; timestamp: number }> = new Map();
  private ttlMs: number;
  private maxSize: number;

  constructor(ttlMs: number = 300000, maxSize: number = 100) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(query: string): number[] | undefined {
    const entry = this.cache.get(query);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(query);
      return undefined;
    }

    return entry.embedding;
  }

  set(query: string, embedding: number[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(query, {
      embedding,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * SmallToBigRetriever - two-phase retrieval with parent expansion
 *
 * Phase 1: Search in small chunks for precise matching
 * Phase 2: Expand to parent chunks for complete context
 *
 * Supports two modes:
 * - Hybrid mode (with HybridSmallToBigRetriever): Uses Qdrant Dense+Sparse search
 * - Legacy mode (without HybridRetriever): Uses in-memory cosine similarity
 */
export class SmallToBigRetriever {
  private config: SmallToBigRetrievalConfig;
  private store: HierarchicalStore;
  private queryCache: QueryCache;
  private embeddingGenerator?: (text: string) => Promise<number[]>;
  private hybridRetriever?: HybridSmallToBigRetriever;
  private embeddingTimeoutMs: number = 10000;

  constructor(
    store: HierarchicalStore,
    config?: Partial<SmallToBigRetrievalConfig>
  ) {
    this.store = store;
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
    this.queryCache = new QueryCache();
  }

  /**
   * Set hybrid retriever for Dense+Sparse search
   * When set, uses Qdrant for vector search instead of in-memory
   */
  setHybridRetriever(retriever: HybridSmallToBigRetriever): void {
    this.hybridRetriever = retriever;
    console.log('[SmallToBigRetriever] Hybrid retriever configured - using Qdrant for search');
  }

  /**
   * Check if hybrid mode is enabled
   */
  isHybridMode(): boolean {
    return this.hybridRetriever !== undefined;
  }

  /**
   * Set embedding generator for queries
   */
  setEmbeddingGenerator(generator: (text: string) => Promise<number[]>): void {
    this.embeddingGenerator = generator;
  }

  /**
   * 6.1: Generate embedding for query with caching
   * 4.3: Log embedding API calls
   * 5.1: Add try-catch for embedding service errors
   * 5.4: Add timeout handling for embedding service calls
   */
  async getQueryEmbedding(query: string): Promise<number[]> {
    // Check cache
    const cached = this.queryCache.get(query);
    if (cached) {
      console.log('[SmallToBigRetriever] Query embedding cache hit | query length:', query.length);
      return cached;
    }

    // Generate new embedding
    if (!this.embeddingGenerator) {
      // Synthetic embedding for testing (when no generator configured)
      console.log('[SmallToBigRetriever] Using synthetic embedding (no generator set)');
      const embedding = this.syntheticEmbedding(query);
      this.queryCache.set(query, embedding);
      return embedding;
    }

    // 4.3: Log embedding API request
    console.log('[SmallToBigRetriever] Embedding API request | query length:', query.length);
    const startTime = Date.now();

    // 5.1 & 5.4: Add try-catch and timeout handling
    try {
      const embedding = await this.withTimeout(
        this.embeddingGenerator(query),
        this.embeddingTimeoutMs,
        'Embedding API timeout'
      );

      // 4.3: Log embedding API response
      const duration = Date.now() - startTime;
      console.log('[SmallToBigRetriever] Embedding API response | duration:', duration, 'ms | dimension:', embedding.length);

      this.queryCache.set(query, embedding);
      return embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[SmallToBigRetriever] Embedding API error | duration:', duration, 'ms | error:', error instanceof Error ? error.message : String(error));

      // 5.1: Throw error to be handled by caller
      throw error;
    }
  }

  /**
   * 5.4: Timeout wrapper for async operations
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  /**
   * Retrieve relevant chunks using Small-to-Big strategy
   * Uses HybridRetriever if configured, otherwise falls back to in-memory search
   */
  async retrieve(query: string): Promise<HierarchicalRetrievalResult[]> {
    // Check if hybrid retriever is configured
    if (this.hybridRetriever) {
      return this.retrieveHybrid(query);
    }

    // Legacy in-memory search mode
    // 6.1: Generate query embedding
    const queryEmbedding = await this.getQueryEmbedding(query);

    // 6.2: Search in small chunks
    const smallResults = this.searchSmallChunks(queryEmbedding);

    // 6.3: Filter by similarity threshold
    const filteredResults = smallResults.filter(
      r => r.similarityScore >= this.config.similarityThreshold
    );

    if (filteredResults.length === 0 && this.config.enableFallback) {
      console.log('[SmallToBigRetriever] Fallback triggered: reason=no primary results above threshold', `| threshold=${this.config.similarityThreshold}`);

      const fallbackResults = await this.fallbackSearch(queryEmbedding);

      console.log('[SmallToBigRetriever] Fallback results:', fallbackResults.length, `| threshold=${this.config.fallbackThreshold}`);

      if (fallbackResults.length === 0) {
        return [];
      }

      return fallbackResults;
    }

    // 6.4: Expand to parent chunks
    const expanded = this.expandToParents(filteredResults);

    // 6.5: Deduplicate parents by parentChunkId
    const seen = new Set<string>();
    const deduplicated = expanded.filter(result => {
      if (seen.has(result.parentChunkId)) {
        return false;
      }
      seen.add(result.parentChunkId);
      return true;
    });

    // 6.6: Limit results
    const limited = deduplicated.slice(0, this.config.topK);

    return limited;
  }

  /**
   * Retrieve using HybridRetriever (Dense+Sparse with Qdrant)
   */
  private async retrieveHybrid(query: string): Promise<HierarchicalRetrievalResult[]> {
    console.log('[SmallToBigRetriever] Using hybrid retrieval (Dense+Sparse)');

    // Call hybrid retriever
    const hybridResults = await this.hybridRetriever!.searchHybrid(
      query,
      this.config.topK,
      undefined
    );

    // Convert HybridSearchResult to HierarchicalRetrievalResult
    const results: HierarchicalRetrievalResult[] = [];

    for (const hr of hybridResults) {
      // Get parent chunk from store for additional metadata
      const parentChunk = this.store.getChunk(hr.parentChunkId);

      results.push({
        smallChunkId: hr.matchedSmallChunks[0]?.smallChunkId ?? hr.parentChunkId,
        parentChunkId: hr.parentChunkId,
        smallChunkContent: hr.matchedSmallChunks[0]?.smallContent ?? '',
        parentChunkContent: hr.parentContent,
        similarityScore: hr.parentScore,
        sourceDocumentId: parentChunk?.sourceDocumentId ?? '',
        metadata: parentChunk?.metadata ?? { contentType: 'text' },
        expandedFromSmallChunk: hr.method === 'hybrid_small',
        qualityScore: parentChunk?.qualityScore ?? { composite: 0, dimensions: { informationDensity: 0, repetitionRatio: 0, semanticCompleteness: 0, documentRelevance: 0 }, evaluatedAt: new Date() },
      });
    }

    console.log('[SmallToBigRetriever] Hybrid retrieval results:', results.length);

    return results;
  }

  /**
   * Multi-Query retrieval: execute multiple queries and merge results
   */
  async retrieveMultiQuery(
    queries: string[],
    options?: {
      topK?: number;
      mergeStrategy?: 'union' | 'intersection' | 'weighted';
    }
  ): Promise<HierarchicalRetrievalResult[]> {
    const { topK = this.config.topK, mergeStrategy = 'union' } = options ?? {};

    console.log('[SmallToBigRetriever] Multi-query retrieval:', {
      queryCount: queries.length,
      mergeStrategy,
      topK,
    });

    // Execute all queries in parallel
    const queryResults = await Promise.all(
      queries.map(q => this.retrieve(q))
    );

    // Merge results based on strategy
    let merged: HierarchicalRetrievalResult[];

    if (mergeStrategy === 'union') {
      merged = this.mergeUnion(queryResults);
    } else if (mergeStrategy === 'intersection') {
      merged = this.mergeIntersection(queryResults);
    } else {
      merged = this.mergeWeighted(queryResults, queries);
    }

    // Deduplicate and limit
    const deduplicated = this.deduplicateResults(merged);
    const limited = deduplicated.slice(0, topK);

    console.log('[SmallToBigRetriever] Multi-query merged:', limited.length, 'results');

    return limited;
  }

  /**
   * Merge results using union strategy (all unique results)
   */
  private mergeUnion(queryResults: HierarchicalRetrievalResult[][]): HierarchicalRetrievalResult[] {
    const allResults: HierarchicalRetrievalResult[] = [];

    for (const results of queryResults) {
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Merge results using intersection (results that appear in multiple queries)
   */
  private mergeIntersection(queryResults: HierarchicalRetrievalResult[][]): HierarchicalRetrievalResult[] {
    if (queryResults.length < 2) {
      return queryResults[0] ?? [];
    }

    // Count occurrences of each result
    const occurrenceMap = new Map<string, { result: HierarchicalRetrievalResult; count: number }>();

    for (const results of queryResults) {
      for (const result of results) {
        const key = result.parentChunkId;
        const existing = occurrenceMap.get(key);
        if (existing) {
          existing.count++;
          // Keep highest similarity score
          if (result.similarityScore > existing.result.similarityScore) {
            existing.result = result;
          }
        } else {
          occurrenceMap.set(key, { result, count: 1 });
        }
      }
    }

    // Only return results that appear in at least 2 query results
    const intersectionResults = Array.from(occurrenceMap.values())
      .filter(entry => entry.count >= 2)
      .map(entry => entry.result);

    return intersectionResults;
  }

  /**
   * Merge results using weighted strategy (higher weight for primary query)
   */
  private mergeWeighted(
    queryResults: HierarchicalRetrievalResult[][],
    queries: string[]
  ): HierarchicalRetrievalResult[] {
    // Primary query (first) gets higher weight
    const weights = queryResults.map((_, i) =>
      i === 0 ? 1.0 : 0.5
    );

    const weightedMap = new Map<string, HierarchicalRetrievalResult>();

    for (let i = 0; i < queryResults.length; i++) {
      const results = queryResults[i] ?? [];
      const weight = weights[i] ?? 0.5;

      for (const result of results) {
        const key = result.parentChunkId;
        const existing = weightedMap.get(key);

        const weightedScore = result.similarityScore * weight;

        if (!existing || weightedScore > existing.similarityScore) {
          weightedMap.set(key, {
            ...result,
            similarityScore: weightedScore,
          });
        }
      }
    }

    return Array.from(weightedMap.values());
  }

  /**
   * Deduplicate results by parentChunkId
   */
  private deduplicateResults(results: HierarchicalRetrievalResult[]): HierarchicalRetrievalResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.parentChunkId)) {
        return false;
      }
      seen.add(result.parentChunkId);
      return true;
    }).sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Convert HierarchicalRetrievalResult to ConfidenceRetrievalResult
   */
  convertToConfidenceResults(
    results: HierarchicalRetrievalResult[]
  ): ConfidenceRetrievalResult[] {
    return results.map(r => createDefaultConfidenceResult({
      smallChunkId: r.smallChunkId,
      parentChunkId: r.parentChunkId,
      smallChunkContent: r.smallChunkContent,
      parentChunkContent: r.parentChunkContent,
      similarityScore: r.similarityScore,
      sourceDocumentId: r.sourceDocumentId,
      metadata: r.metadata,
      expandedFromSmallChunk: r.expandedFromSmallChunk,
      // Pass quality score for confidence calculation
      qualityScore: r.qualityScore,
    }));
  }

  /**
   * Multi-query retrieval with confidence scores
   */
  async retrieveMultiQueryWithConfidence(
    queries: string[],
    options?: {
      topK?: number;
      mergeStrategy?: 'union' | 'intersection' | 'weighted';
    }
  ): Promise<ConfidenceRetrievalResult[]> {
    const hierarchicalResults = await this.retrieveMultiQuery(queries, options);
    return this.convertToConfidenceResults(hierarchicalResults);
  }

  /**
   * 6.2: Search in small chunks with cosine similarity
   * 4.1: Log similarity scores for debugging
   */
  private searchSmallChunks(
    queryEmbedding: number[]
  ): HierarchicalRetrievalResult[] {
    const smallChunks = this.store.getAllSmallChunks();
    const results: HierarchicalRetrievalResult[] = [];

    for (const chunk of smallChunks) {
      if (chunk.embedding.length === 0) continue;

      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);

      results.push({
        smallChunkId: chunk.id,
        parentChunkId: chunk.parentId ?? '',
        smallChunkContent: chunk.content,
        parentChunkContent: '', // Will be filled during expansion
        similarityScore: similarity,
        sourceDocumentId: chunk.sourceDocumentId,
        metadata: chunk.metadata,
        expandedFromSmallChunk: true,
        // Pass quality score from chunk for confidence calculation
        qualityScore: chunk.qualityScore,
      });
    }

    // Sort by similarity descending
    const sorted = sortBySimilarity(results);

    // 4.1: Log top similarity scores and match count
    if (sorted.length > 0) {
      const topScores = sorted.slice(0, 5).map(r => r.similarityScore.toFixed(3));
      console.log('[SmallToBigRetriever] searchSmallChunks: top scores:', topScores.join(', '), `| total chunks: ${sorted.length}`);
    }

    return sorted;
  }

  /**
   * 6.4: Expand small chunk results to parent chunks with context window extraction
   */
  private expandToParents(
    results: HierarchicalRetrievalResult[]
  ): HierarchicalRetrievalResult[] {
    const contextWindowConfig = this.config.contextWindow ?? DEFAULT_CONTEXT_WINDOW_CONFIG;

    return results.map(result => {
      const parent = this.store.getParentChunk(result.smallChunkId);

      if (parent) {
        // Extract context window around the matched small chunk
        const { contextWindow, windowStart, windowEnd } = this.extractContextWindow(
          parent.content,
          result.smallChunkContent,
          contextWindowConfig
        );

        // Log window extraction for debugging
        console.log(
          '[SmallToBigRetriever] Context window extracted',
          '| window length:', contextWindow.length,
          '| parent length:', parent.content.length,
          '| position:', windowStart, '-', windowEnd
        );

        return {
          ...result,
          parentChunkId: parent.id,
          parentChunkContent: parent.content, // Keep full parent for backward compatibility
          contextWindow,
          windowStart,
          windowEnd,
        };
      }

      // If no parent, use small chunk content as parent
      return {
        ...result,
        parentChunkContent: result.smallChunkContent,
        contextWindow: result.smallChunkContent,
        windowStart: 0,
        windowEnd: result.smallChunkContent.length,
      };
    });
  }

  /**
   * Extract context window around matched small chunk content
   */
  private extractContextWindow(
    parentContent: string,
    smallChunkContent: string,
    config: ContextWindowConfig
  ): { contextWindow: string; windowStart: number; windowEnd: number } {
    // Find the position of small chunk in parent
    const matchPosition = this.findSmallChunkPosition(parentContent, smallChunkContent);

    if (matchPosition === -1) {
      // Small chunk not found in parent - return small chunk itself
      console.warn('[SmallToBigRetriever] Small chunk not found in parent, using small chunk as window');
      return {
        contextWindow: smallChunkContent,
        windowStart: 0,
        windowEnd: smallChunkContent.length,
      };
    }

    // Calculate window boundaries
    let windowStart = Math.max(0, matchPosition - config.beforeChars);
    let windowEnd = Math.min(parentContent.length, matchPosition + smallChunkContent.length + config.afterChars);

    // Apply sentence boundary respect if enabled
    if (config.respectSentenceBoundary) {
      windowStart = this.findSentenceBoundary(parentContent, windowStart, 'backward');
      windowEnd = this.findSentenceBoundary(parentContent, windowEnd, 'forward');
    }

    const contextWindow = parentContent.substring(windowStart, windowEnd);

    return { contextWindow, windowStart, windowEnd };
  }

  /**
   * Find the position of small chunk content in parent content
   */
  private findSmallChunkPosition(parentContent: string, smallChunkContent: string): number {
    // Direct match
    let position = parentContent.indexOf(smallChunkContent);
    if (position !== -1) {
      return position;
    }

    // Try normalized match (trim whitespace variations)
    const normalizedSmall = smallChunkContent.trim();
    const normalizedParent = parentContent;

    position = normalizedParent.indexOf(normalizedSmall);
    if (position !== -1) {
      return position;
    }

    // Try to find by first significant line
    const firstLine = smallChunkContent.split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 20) {
      position = parentContent.indexOf(firstLine);
      if (position !== -1) {
        return position;
      }
    }

    // Not found
    return -1;
  }

  /**
   * Find nearest sentence boundary in given direction
   */
  private findSentenceBoundary(
    content: string,
    position: number,
    direction: 'forward' | 'backward'
  ): number {
    const sentenceEnders = ['.', '!', '?', '。', '！', '？', '\n\n'];

    if (direction === 'forward') {
      // Find next sentence end after position
      for (let i = position; i < Math.min(position + 100, content.length); i++) {
        if (sentenceEnders.includes(content[i] ?? '')) {
          return i + 1;
        }
      }
      return position;
    } else {
      // Find previous sentence start before position
      for (let i = position; i > Math.max(0, position - 100); i--) {
        if (sentenceEnders.includes(content[i] ?? '')) {
          return i + 1;
        }
      }
      return position;
    }
  }

  /**
   * 6.7: Fallback search directly in parent chunks
   */
  private async fallbackSearch(
    queryEmbedding: number[]
  ): Promise<HierarchicalRetrievalResult[]> {
    const parentChunks = this.store.getAllParentChunks();
    const results: HierarchicalRetrievalResult[] = [];

    for (const parent of parentChunks) {
      if (parent.embedding.length === 0) continue;

      const similarity = cosineSimilarity(queryEmbedding, parent.embedding);

      results.push({
        smallChunkId: parent.childIds?.[0] ?? parent.id,
        parentChunkId: parent.id,
        smallChunkContent: '',
        parentChunkContent: parent.content,
        similarityScore: similarity,
        sourceDocumentId: parent.sourceDocumentId,
        metadata: parent.metadata,
        expandedFromSmallChunk: false,
      });
    }

    return sortBySimilarity(results)
      .filter(r => r.similarityScore >= this.config.fallbackThreshold)
      .slice(0, this.config.topK);
  }

  /**
   * 6.6: Assemble context from results with token limit
   */
  assembleContext(results: HierarchicalRetrievalResult[]): AssembledContext {
    const chunks: HierarchicalRetrievalResult[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const result of results) {
      const content = result.parentChunkContent || result.smallChunkContent;
      const tokens = this.estimateTokens(content);

      if (totalTokens + tokens <= this.config.maxContextTokens) {
        chunks.push(result);
        totalTokens += tokens;
      } else {
        truncated = true;
        break;
      }
    }

    const content = chunks
      .map(c => c.parentChunkContent || c.smallChunkContent)
      .join('\n\n---\n\n');

    return {
      content,
      tokenCount: totalTokens,
      chunks,
      truncated,
    };
  }

  /**
   * 6.8: Retrieve with full metadata
   */
  async retrieveWithMetadata(
    query: string
  ): Promise<{
    results: HierarchicalRetrievalResult[];
    context: AssembledContext;
    queryEmbedding: number[];
  }> {
    const results = await this.retrieve(query);
    const context = this.assembleContext(results);
    const queryEmbedding = await this.getQueryEmbedding(query);

    return {
      results,
      context,
      queryEmbedding,
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate synthetic embedding for testing
   * Uses the same dimension as stored chunks for compatibility
   */
  private syntheticEmbedding(text: string): number[] {
    // Get dimension from stored chunks to match
    const smallChunks = this.store.getAllSmallChunks();
    let dimension = 384; // Default to multilingual-e5-small dimension

    if (smallChunks.length > 0) {
      const firstChunk = smallChunks[0];
      if (firstChunk && firstChunk.embedding && firstChunk.embedding.length > 0) {
        dimension = firstChunk.embedding.length;
      }
    }

    const embedding: number[] = new Array(dimension).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = i % dimension;
      embedding[idx] = (embedding[idx] ?? 0) + charCode / 255;
    }

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] = (embedding[i] ?? 0) / norm;
      }
    }

    return embedding;
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): SmallToBigRetrievalConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<SmallToBigRetrievalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create Small-to-Big retriever
 */
export function createSmallToBigRetriever(
  store: HierarchicalStore,
  config?: Partial<SmallToBigRetrievalConfig>
): SmallToBigRetriever {
  return new SmallToBigRetriever(store, config);
}