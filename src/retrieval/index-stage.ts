import { BasePlugin } from '../core/plugin.js';
import { BaseStage } from '../core/stage.js';
import type { Context, EmbeddingResult } from '../core/context.js';
import { ProcessingState as State } from '../core/context.js';
import { InMemoryVectorStore } from './vector-store.js';
import type { VectorStore, VectorStoreStats } from './vector-store.js';
import type { SearchResult, QueryOptions } from '../core/types.js';

/**
 * Index stage configuration
 */
export interface IndexStageConfig {
  storeType: 'memory' | 'chromadb';
  chromadbPath?: string;
}

/**
 * Default index stage configuration
 */
export const DEFAULT_INDEX_CONFIG: IndexStageConfig = {
  storeType: 'memory',
};

/**
 * Index plugin - indexes embeddings for retrieval
 */
export class IndexPlugin extends BasePlugin {
  private store: VectorStore;

  constructor(store?: VectorStore) {
    super('index');
    this.store = store ?? new InMemoryVectorStore();
  }

  /**
   * Process embeddings through indexing
   */
  async process(ctx: Context): Promise<Context> {
    const embeddings = ctx.getEmbeddings();

    if (!embeddings || embeddings.length === 0) {
      ctx.addError({
        stage: 'index',
        plugin: this.name,
        message: 'No embeddings to index',
        recoverable: false,
      });
      return ctx;
    }

    try {
      // Add embeddings to vector store
      await this.store.add(embeddings);

      // Get stats
      const stats = await this.store.getStats();
      ctx.set('indexStats', stats);

      ctx.setState(State.INDEXING);

    } catch (error) {
      ctx.addError({
        stage: 'index',
        plugin: this.name,
        message: error instanceof Error ? error.message : 'Indexing failed',
        recoverable: false,
      });
    }

    return ctx;
  }

  /**
   * Get the vector store
   */
  getStore(): VectorStore {
    return this.store;
  }
}

/**
 * Index stage - orchestrates embedding indexing
 */
export class IndexStage extends BaseStage {
  private plugin: IndexPlugin;

  constructor(store?: VectorStore) {
    const plugin = new IndexPlugin(store);
    super('index', [plugin]);
    this.plugin = plugin;
  }

  /**
   * Get the vector store from this stage
   */
  getStore(): VectorStore {
    return this.plugin.getStore();
  }
}

/**
 * Retrieval service - provides query interface
 */
export class RetrievalService {
  private store: VectorStore;
  private embedder: (text: string) => Promise<number[]>;

  constructor(
    store: VectorStore,
    embedder: (text: string) => Promise<number[]>
  ) {
    this.store = store;
    this.embedder = embedder;
  }

  /**
   * Query for similar content
   */
  async query(queryText: string, options?: QueryOptions): Promise<SearchResult[]> {
    const vector = await this.embedder(queryText);
    return this.store.search(vector, options);
  }

  /**
   * Query by vector directly
   */
  async queryByVector(vector: number[], options?: QueryOptions): Promise<SearchResult[]> {
    return this.store.search(vector, options);
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<EmbeddingResult[]> {
    return this.store.getByDocumentId(documentId);
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<number> {
    return this.store.removeByDocumentId(documentId);
  }

  /**
   * Get stats
   */
  async getStats(): Promise<VectorStoreStats> {
    return this.store.getStats();
  }
}

/**
 * Create index stage
 */
export function createIndexStage(store?: VectorStore): IndexStage {
  return new IndexStage(store);
}

/**
 * Create retrieval service
 */
export function createRetrievalService(
  store: VectorStore,
  embedder: (text: string) => Promise<number[]>
): RetrievalService {
  return new RetrievalService(store, embedder);
}