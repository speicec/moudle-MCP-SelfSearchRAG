/**
 * QdrantVectorStoreAdapter - Production-grade vector store implementation
 *
 * Features:
 * - HNSW indexing for fast dense vector search
 * - Sparse vector indexing for keyword matching
 * - Three collection architecture
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type {
  VectorStoreAdapter,
  VectorPoint,
  SearchQuery,
  SearchResult,
  MetadataFilter,
  CollectionConfig,
  CollectionStats,
  VectorPayload,
} from './vector-store-adapter.js';
import { COLLECTION_NAMES } from './vector-store-adapter.js';
import { DEFAULT_QDRANT_CONFIG, DEFAULT_COLLECTION_CONFIG } from '../config/vector-db-config.js';

/**
 * Qdrant adapter configuration
 */
export interface QdrantAdapterConfig {
  url: string;
  apiKey?: string | undefined;
  timeoutMs: number;
}

/**
 * QdrantVectorStoreAdapter implementation
 */
export class QdrantVectorStoreAdapter implements VectorStoreAdapter {
  private client: QdrantClient;
  private config: QdrantAdapterConfig;
  private initialized = false;
  private connectionHealthy = false;

  constructor(config?: Partial<QdrantAdapterConfig>) {
    const apiKey = config?.apiKey ?? DEFAULT_QDRANT_CONFIG.apiKey;
    this.config = {
      url: config?.url ?? DEFAULT_QDRANT_CONFIG.url,
      apiKey: apiKey,
      timeoutMs: config?.timeoutMs ?? DEFAULT_QDRANT_CONFIG.timeoutMs,
    };

    // Create client with proper typing
    const clientConfig: any = { url: this.config.url };
    if (this.config.apiKey) {
      clientConfig.apiKey = this.config.apiKey;
    }
    this.client = new QdrantClient(clientConfig);
  }

  async initialize(): Promise<void> {
    console.log(`[QdrantAdapter] Initializing connection to ${this.config.url}`);

    try {
      // Check connection by listing collections
      await this.client.getCollections();

      // Create collections if they don't exist
      await this.createCollections();

      this.initialized = true;
      this.connectionHealthy = true;
      console.log('[QdrantAdapter] Initialization complete');
    } catch (error) {
      console.error('[QdrantAdapter] Initialization failed:', error);
      throw error;
    }
  }

  private async createCollections(): Promise<void> {
    const collections = await this.client.getCollections();
    const existingNames = collections.collections.map(c => c.name);

    // text_chunks: Dense + Sparse
    if (!existingNames.includes(COLLECTION_NAMES.TEXT_CHUNKS)) {
      await this.createTextChunksCollection();
    }

    // parent_chunks: Sparse only
    if (!existingNames.includes(COLLECTION_NAMES.PARENT_CHUNKS)) {
      await this.createParentChunksCollection();
    }

    // image_chunks: Dense only
    if (!existingNames.includes(COLLECTION_NAMES.IMAGE_CHUNKS)) {
      await this.createImageChunksCollection();
    }
  }

  private async createTextChunksCollection(): Promise<void> {
    const config = DEFAULT_COLLECTION_CONFIG.text;
    // Use NAMED dense vector so sparse vectors work correctly
    // When using named sparse vectors, dense vectors must also be named
    await this.client.createCollection(COLLECTION_NAMES.TEXT_CHUNKS, {
      vectors: {
        'text_dense': {
          size: config.dimension,
          distance: 'Cosine',
          hnsw_config: {
            m: config.hnsw.m,
            ef_construct: config.hnsw.efConstruct,
          },
        },
      },
      sparse_vectors: {
        'text_sparse': { modifier: 'idf' },
      },
    });
    console.log(`[QdrantAdapter] Created ${COLLECTION_NAMES.TEXT_CHUNKS} with named vectors (text_dense + text_sparse)`);
  }

  private async createParentChunksCollection(): Promise<void> {
    await this.client.createCollection(COLLECTION_NAMES.PARENT_CHUNKS, {
      vectors: {},
      sparse_vectors: {
        'parent_sparse': { modifier: 'idf' },
      },
    });
    console.log(`[QdrantAdapter] Created ${COLLECTION_NAMES.PARENT_CHUNKS} with sparse vectors only (parent_sparse)`);
  }

  private async createImageChunksCollection(): Promise<void> {
    const config = DEFAULT_COLLECTION_CONFIG.image;
    // Use named dense vector for consistency
    await this.client.createCollection(COLLECTION_NAMES.IMAGE_CHUNKS, {
      vectors: {
        'image_dense': {
          size: config.dimension,
          distance: 'Cosine',
          hnsw_config: {
            m: config.hnsw.m,
            ef_construct: config.hnsw.efConstruct,
          },
        },
      },
    });
    console.log(`[QdrantAdapter] Created ${COLLECTION_NAMES.IMAGE_CHUNKS} with named dense vector (image_dense)`);
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.connectionHealthy = false;
    console.log('[QdrantAdapter] Shutdown complete');
  }

  isReady(): boolean {
    return this.initialized && this.connectionHealthy;
  }

  async createCollection(name: string, config: CollectionConfig): Promise<void> {
    if (await this.collectionExists(name)) {
      return;
    }

    const createConfig: any = {
      vectors: config.dimension > 0 ? {
        size: config.dimension,
        distance: config.distance,
      } : {},
    };

    if (config.enableSparse) {
      createConfig.sparse_vectors = { 'default_sparse': { modifier: 'idf' } };
    }

    await this.client.createCollection(name, createConfig);
    console.log(`[QdrantAdapter] Created collection ${name}`);
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.deleteCollection(name);
    console.log(`[QdrantAdapter] Deleted collection ${name}`);
  }

  async collectionExists(name: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(c => c.name === name);
    } catch {
      return false;
    }
  }

  async upsert(collection: string, points: VectorPoint[]): Promise<void> {
    const isTextChunks = collection === COLLECTION_NAMES.TEXT_CHUNKS;
    const isParentChunks = collection === COLLECTION_NAMES.PARENT_CHUNKS;
    const isImageChunks = collection === COLLECTION_NAMES.IMAGE_CHUNKS;

    const qdrantPoints = points.map(p => {
      const point: any = {
        id: p.id,
        payload: this.payloadToQdrant(p.payload),
      };

      // Use single vector object with named keys for all collections
      // This is required for named sparse vectors to work correctly
      if (isTextChunks) {
        // text_chunks: named dense + named sparse in single vector object
        point.vector = {};
        if (p.vector) {
          point.vector['text_dense'] = p.vector;
        }
        if (p.sparseVector) {
          point.vector['text_sparse'] = p.sparseVector;
        }
      } else if (isParentChunks) {
        // parent_chunks: sparse only, empty vector object
        point.vector = {};
        if (p.sparseVector) {
          point.vector['parent_sparse'] = p.sparseVector;
        }
      } else if (isImageChunks) {
        // image_chunks: named dense only
        point.vector = {};
        if (p.vector) {
          point.vector['image_dense'] = p.vector;
        }
      } else {
        // Dynamic collections: use default names
        point.vector = {};
        if (p.vector) {
          point.vector['default_dense'] = p.vector;
        }
        if (p.sparseVector) {
          point.vector['default_sparse'] = p.sparseVector;
        }
      }

      return point;
    });

    await this.client.upsert(collection, { wait: true, points: qdrantPoints });
    console.log(`[QdrantAdapter] Upserted ${points.length} points to ${collection}`);
  }

  private payloadToQdrant(payload: VectorPayload): Record<string, any> {
    const result: Record<string, any> = {
      documentId: payload.documentId,
      chunkId: payload.chunkId,
      level: payload.level,
      modality: payload.modality,
      qualityScore: payload.qualityScore,
      contentType: payload.contentType,
    };

    if (payload.position !== undefined) {
      result.position_start = payload.position.start;
      result.position_end = payload.position.end;
    }

    if (payload.parentId !== undefined) result.parentId = payload.parentId;
    if (payload.pageNumber !== undefined) result.pageNumber = payload.pageNumber;
    if (payload.childIds !== undefined) result.childIds = payload.childIds;
    if (payload.vlmText !== undefined) result.vlmText = payload.vlmText;
    if (payload.blockType !== undefined) result.blockType = payload.blockType;
    if (payload.content !== undefined) result.content = payload.content;

    return result;
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    await this.client.delete(collection, { wait: true, points: ids });
    console.log(`[QdrantAdapter] Deleted ${ids.length} points from ${collection}`);
  }

  async deleteByFilter(collection: string, filter: MetadataFilter): Promise<number> {
    const qdrantFilter = this.buildFilter(filter);
    await this.client.delete(collection, { wait: true, filter: qdrantFilter });
    return 0;
  }

  async searchDense(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    if (!query.vector) return [];

    // Determine the dense vector name based on collection
    const denseName = collection === COLLECTION_NAMES.TEXT_CHUNKS
      ? 'text_dense'
      : collection === COLLECTION_NAMES.IMAGE_CHUNKS
        ? 'image_dense'
        : 'default_dense';

    // Use NamedVector format: { name: string, vector: number[] }
    const searchParams: any = {
      vector: {
        name: denseName,
        vector: query.vector,
      },
      limit: query.topK,
    };

    if (query.threshold) searchParams.score_threshold = query.threshold;
    if (query.filter) searchParams.filter = this.buildFilter(query.filter);
    if (query.ef) searchParams.hnsw_ef = query.ef;

    const results = await this.client.search(collection, searchParams);
    return results.map(r => this.toSearchResult(r, 'dense'));
  }

  async searchSparse(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    if (!query.sparseVector) return [];

    const sparseName = collection === COLLECTION_NAMES.PARENT_CHUNKS ? 'parent_sparse' : 'text_sparse';

    // Qdrant SearchRequest requires 'vector' field (NamedSparseVector format)
    // NamedSparseVector: { name: string, vector: { indices, values } }
    const searchParams: any = {
      vector: {
        name: sparseName,
        vector: query.sparseVector,
      },
      limit: query.topK,
    };

    if (query.threshold) searchParams.score_threshold = query.threshold;
    if (query.filter) searchParams.filter = this.buildFilter(query.filter);

    const results = await this.client.search(collection, searchParams);
    return results.map(r => this.toSearchResult(r, 'sparse'));
  }

  async searchHybrid(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    const [dense, sparse] = await Promise.all([
      query.vector ? this.searchDense(collection, query) : Promise.resolve([]),
      query.sparseVector ? this.searchSparse(collection, query) : Promise.resolve([]),
    ]);

    const fused = new Map<string, SearchResult>();
    for (const r of dense) fused.set(r.id, r);
    for (const r of sparse) {
      const existing = fused.get(r.id);
      if (existing) {
        existing.score = Math.max(existing.score, r.score);
        existing.matchSource = 'hybrid';
      } else {
        fused.set(r.id, r);
      }
    }

    const results = Array.from(fused.values());
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, query.topK);
  }

  private toSearchResult(result: any, source: 'dense' | 'sparse'): SearchResult {
    const payload = result.payload as Record<string, any>;
    return {
      id: String(result.id),
      score: result.score as number,
      payload: {
        documentId: payload.documentId as string,
        chunkId: payload.chunkId as string,
        parentId: payload.parentId as string | undefined,
        level: payload.level as 'small' | 'parent',
        modality: payload.modality as 'text' | 'image',
        qualityScore: payload.qualityScore as number,
        pageNumber: payload.pageNumber as number | undefined,
        contentType: payload.contentType as string,
        position: {
          start: payload.position_start as number,
          end: payload.position_end as number,
        },
        childIds: payload.childIds as string[] | undefined,
        vlmText: payload.vlmText as string | undefined,
        blockType: payload.blockType as 'figure' | 'table' | 'formula' | undefined,
        content: payload.content as string | undefined,
      },
      matchSource: source,
    };
  }

  async getStats(collection: string): Promise<CollectionStats> {
    const info = await this.client.getCollection(collection);
    return {
      name: collection,
      vectorCount: info.points_count ?? 0,
      denseVectorCount: info.indexed_vectors_count ?? undefined,
      sparseVectorCount: undefined,
      dimension: undefined,
      indexStatus: info.status === 'green' ? 'green' : info.status === 'yellow' ? 'yellow' : 'red',
    };
  }

  async getPoint(collection: string, id: string): Promise<VectorPoint | null> {
    try {
      const points = await this.client.retrieve(collection, {
        ids: [id],
        with_payload: true,
        with_vector: true,
      });

      if (points.length === 0) return null;

      const p = points[0] as any;
      const payload = p.payload as Record<string, any>;

      // Parse named vectors from response
      // vector is now an object with named keys: {text_dense: [...], text_sparse: {...}}
      const vectorObj = p.vector as Record<string, any> | undefined;

      // Determine vector names based on collection
      const denseName = collection === COLLECTION_NAMES.TEXT_CHUNKS
        ? 'text_dense'
        : collection === COLLECTION_NAMES.IMAGE_CHUNKS
          ? 'image_dense'
          : 'default_dense';
      const sparseName = collection === COLLECTION_NAMES.PARENT_CHUNKS
        ? 'parent_sparse'
        : 'text_sparse';

      // Extract dense vector
      let denseVector: number[] | undefined = undefined;
      if (vectorObj) {
        if (vectorObj[denseName]) {
          denseVector = vectorObj[denseName] as number[];
        }
      }

      // Extract sparse vector
      let sparseVector = undefined;
      if (vectorObj && vectorObj[sparseName]) {
        sparseVector = vectorObj[sparseName];
      }

      return {
        id: String(p.id),
        vector: denseVector,
        sparseVector,
        payload: {
          documentId: payload.documentId as string,
          chunkId: payload.chunkId as string,
          parentId: payload.parentId as string | undefined,
          level: payload.level as 'small' | 'parent',
          modality: payload.modality as 'text' | 'image',
          qualityScore: payload.qualityScore as number,
          pageNumber: payload.pageNumber as number | undefined,
          contentType: payload.contentType as string,
          position: {
            start: payload.position_start as number,
            end: payload.position_end as number,
          },
          childIds: payload.childIds as string[] | undefined,
          vlmText: payload.vlmText as string | undefined,
          blockType: payload.blockType as 'figure' | 'table' | 'formula' | undefined,
          content: payload.content as string | undefined,
        },
      };
    } catch {
      return null;
    }
  }

  private buildFilter(filter: MetadataFilter): any {
    const conditions: any[] = [];

    if (filter.documentId) {
      conditions.push({ key: 'documentId', match: { value: filter.documentId } });
    }

    if (filter.minQuality !== undefined || filter.maxQuality !== undefined) {
      conditions.push({
        key: 'qualityScore',
        range: { gte: filter.minQuality ?? 0, lte: filter.maxQuality ?? 1 },
      });
    }

    if (filter.pageNumbers?.length) {
      conditions.push({ key: 'pageNumber', match: { any: filter.pageNumbers } });
    }

    if (filter.modality) {
      conditions.push({ key: 'modality', match: { value: filter.modality } });
    }

    if (filter.contentTypes?.length) {
      conditions.push({ key: 'contentType', match: { any: filter.contentTypes } });
    }

    if (filter.level) {
      conditions.push({ key: 'level', match: { value: filter.level } });
    }

    if (filter.parentId) {
      conditions.push({ key: 'parentId', match: { value: filter.parentId } });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  async upsertSmall(points: VectorPoint[]): Promise<void> {
    await this.upsert(COLLECTION_NAMES.TEXT_CHUNKS, points);
  }

  async upsertParent(points: VectorPoint[]): Promise<void> {
    await this.upsert(COLLECTION_NAMES.PARENT_CHUNKS, points);
  }

  async upsertImage(points: VectorPoint[]): Promise<void> {
    await this.upsert(COLLECTION_NAMES.IMAGE_CHUNKS, points);
  }
}

export function createQdrantVectorStoreAdapter(config?: Partial<QdrantAdapterConfig>): QdrantVectorStoreAdapter {
  return new QdrantVectorStoreAdapter(config);
}