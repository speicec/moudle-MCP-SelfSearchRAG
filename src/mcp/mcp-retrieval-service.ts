import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import type { HierarchicalRetrievalResult } from '../chunking/types.js';

/**
 * MCP Retrieval result format
 */
export interface McpRetrievalResult {
  smallChunkId: string;
  parentChunkId: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
  contextWindow?: string | undefined;
  windowStart?: number | undefined;
  windowEnd?: number | undefined;
}

/**
 * MCP Query options
 */
export interface McpQueryOptions {
  topK?: number;
  threshold?: number;
  maxContextTokens?: number;
}

/**
 * MCP Retrieval stats
 */
export interface McpRetrievalStats {
  smallChunks: number;
  parentChunks: number;
  documentIds: string[];
  lastUpdated?: string;
}

/**
 * MCP RetrievalService - wraps HierarchicalStore and SmallToBigRetriever
 *
 * Provides the query interface for MCP tools using the Small-to-Big retrieval strategy.
 * Returns results with parent chunk content for richer context.
 */
export class McpRetrievalService {
  private store: HierarchicalStore;
  private retriever: SmallToBigRetriever;
  private embeddingGenerator?: (text: string) => Promise<number[]>;

  constructor(
    store: HierarchicalStore,
    embeddingGenerator?: (text: string) => Promise<number[]>
  ) {
    this.store = store;
    this.retriever = new SmallToBigRetriever(store);

    if (embeddingGenerator) {
      this.embeddingGenerator = embeddingGenerator;
      this.retriever.setEmbeddingGenerator(embeddingGenerator);
    }
  }

  /**
   * Set embedding generator for queries
   */
  setEmbeddingGenerator(generator: (text: string) => Promise<number[]>): void {
    this.embeddingGenerator = generator;
    this.retriever.setEmbeddingGenerator(generator);
  }

  /**
   * Query for relevant content using Small-to-Big retrieval
   *
   * Returns results in Small-to-Big format with parent chunk content.
   */
  async query(queryText: string, options?: McpQueryOptions): Promise<McpRetrievalResult[]> {
    const { topK = 5, threshold = 0.0, maxContextTokens = 4000 } = options ?? {};

    // Check if store has data
    const chunkCount = this.store.getChunkCount();
    if (chunkCount.small === 0) {
      console.log('[McpRetrievalService] No chunks in store, returning empty results');
      return [];
    }

    // Update retriever config for this query
    this.retriever.setConfig({
      topK,
      similarityThreshold: threshold,
      maxContextTokens,
    });

    // Execute retrieval
    const { results } = await this.retriever.retrieveWithMetadata(queryText);

    // Map to MCP result format
    return results.map(r => ({
      smallChunkId: r.smallChunkId,
      parentChunkId: r.parentChunkId,
      parentChunkContent: r.parentChunkContent,
      similarityScore: r.similarityScore,
      sourceDocumentId: r.sourceDocumentId,
      contextWindow: r.contextWindow,
      windowStart: r.windowStart,
      windowEnd: r.windowEnd,
    }));
  }

  /**
   * Get stats about the store
   */
  getStats(): McpRetrievalStats {
    const chunkCount = this.store.getChunkCount();
    const smallChunks = this.store.getAllSmallChunks();
    const documentIds = [...new Set(smallChunks.map(c => c.sourceDocumentId))];

    return {
      smallChunks: chunkCount.small,
      parentChunks: chunkCount.parent,
      documentIds,
    };
  }

  /**
   * Delete all chunks for a document
   *
   * Returns the number of chunks removed.
   */
  deleteDocument(documentId: string): number {
    const { small, parent } = this.store.getChunksByDocument(documentId);
    const removedCount = small.length + parent.length;

    this.store.removeDocumentChunks(documentId);

    console.log(`[McpRetrievalService] Deleted document ${documentId}: ${removedCount} chunks removed`);

    return removedCount;
  }

  /**
   * Get the underlying HierarchicalStore
   */
  getStore(): HierarchicalStore {
    return this.store;
  }

  /**
   * Get the underlying SmallToBigRetriever
   */
  getRetriever(): SmallToBigRetriever {
    return this.retriever;
  }
}

/**
 * Create MCP RetrievalService
 */
export function createMcpRetrievalService(
  store: HierarchicalStore,
  embeddingGenerator?: (text: string) => Promise<number[]>
): McpRetrievalService {
  return new McpRetrievalService(store, embeddingGenerator);
}