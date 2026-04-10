import type {
  HierarchicalChunk,
  HierarchicalRetrievalResult,
  AssembledContext,
} from './types.js';
import type { SmallToBigRetrievalConfig } from './config.js';
import { DEFAULT_RETRIEVAL_CONFIG } from './config.js';
import { HierarchicalStore } from './hierarchical-store.js';
import { cosineSimilarity, sortBySimilarity } from './utils.js';

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
 */
export class SmallToBigRetriever {
  private config: SmallToBigRetrievalConfig;
  private store: HierarchicalStore;
  private queryCache: QueryCache;
  private embeddingGenerator?: (text: string) => Promise<number[]>;
  private embeddingTimeoutMs: number = 10000; // 10 second timeout for embedding calls (5.4)

  constructor(
    store: HierarchicalStore,
    config?: Partial<SmallToBigRetrievalConfig>
  ) {
    this.store = store;
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
    this.queryCache = new QueryCache();
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
   */
  async retrieve(query: string): Promise<HierarchicalRetrievalResult[]> {
    // 6.1: Generate query embedding
    const queryEmbedding = await this.getQueryEmbedding(query);

    // 6.2: Search in small chunks
    const smallResults = this.searchSmallChunks(queryEmbedding);

    // 6.3: Filter by similarity threshold
    const filteredResults = smallResults.filter(
      r => r.similarityScore >= this.config.similarityThreshold
    );

    if (filteredResults.length === 0 && this.config.enableFallback) {
      // 4.2: Log fallback trigger with reason and result count
      console.log('[SmallToBigRetriever] Fallback triggered: reason=no primary results above threshold', `| threshold=${this.config.similarityThreshold}`);

      // 6.7: Fallback to direct parent search
      const fallbackResults = await this.fallbackSearch(queryEmbedding);

      // 4.2: Log fallback result count
      console.log('[SmallToBigRetriever] Fallback results:', fallbackResults.length, `| threshold=${this.config.fallbackThreshold}`);

      // 3.3: Early termination when no fallback results meet threshold
      if (fallbackResults.length === 0) {
        return []; // No results meet fallback threshold
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
   * 6.4: Expand small chunk results to parent chunks
   */
  private expandToParents(
    results: HierarchicalRetrievalResult[]
  ): HierarchicalRetrievalResult[] {
    return results.map(result => {
      const parent = this.store.getParentChunk(result.smallChunkId);

      if (parent) {
        return {
          ...result,
          parentChunkId: parent.id,
          parentChunkContent: parent.content,
        };
      }

      // If no parent, use small chunk content as parent
      return {
        ...result,
        parentChunkContent: result.smallChunkContent,
      };
    });
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
   * Uses the configured embedding dimension (default 384 for multilingual-e5-small)
   */
  private syntheticEmbedding(text: string): number[] {
    const dimension = 384; // Match multilingual-e5-small dimension
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