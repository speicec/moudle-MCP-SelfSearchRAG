/**
 * InMemoryVectorStoreAdapter - Local testing fallback
 *
 * Wraps existing InMemoryVectorStore with VectorStoreAdapter interface.
 * Supports:
 * - Dense vector search (linear scan)
 * - Sparse vector search (keyword matching simulation)
 * - Metadata filtering
 *
 * Note: Performance is O(N) - use only for testing/development.
 * For production, use QdrantVectorStore with HNSW indexing.
 */

import type {
  VectorStoreAdapter,
  VectorPoint,
  SearchQuery,
  SearchResult,
  MetadataFilter,
  CollectionConfig,
  CollectionStats,
  VectorPayload,
  SparseVector,
  COLLECTION_NAMES,
} from './vector-store-adapter.js';

/**
 * Internal storage for a collection
 */
interface CollectionData {
  config: CollectionConfig;
  points: Map<string, VectorPoint>;
}

/**
 * InMemoryVectorStoreAdapter implementation
 */
export class InMemoryVectorStoreAdapter implements VectorStoreAdapter {
  private collections: Map<string, CollectionData> = new Map();
  private initialized = false;
  private sparseIndex: Map<string, Map<string, Set<string>>> = new Map(); // collection -> term -> pointIds

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    this.initialized = true;
    console.log('[InMemoryAdapter] Initialized (development/testing mode)');
  }

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    this.collections.clear();
    this.sparseIndex.clear();
    this.initialized = false;
    console.log('[InMemoryAdapter] Shutdown complete');
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Create a collection
   */
  async createCollection(name: string, config: CollectionConfig): Promise<void> {
    if (this.collections.has(name)) {
      console.log(`[InMemoryAdapter] Collection ${name} already exists, skipping creation`);
      return;
    }

    this.collections.set(name, {
      config,
      points: new Map(),
    });

    if (config.enableSparse) {
      this.sparseIndex.set(name, new Map());
    }

    console.log(`[InMemoryAdapter] Created collection ${name} (dim: ${config.dimension}, sparse: ${config.enableSparse})`);
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    this.collections.delete(name);
    this.sparseIndex.delete(name);
    console.log(`[InMemoryAdapter] Deleted collection ${name}`);
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    return this.collections.has(name);
  }

  /**
   * Upsert vectors
   */
  async upsert(collection: string, points: VectorPoint[]): Promise<void> {
    const coll = this.collections.get(collection);
    if (!coll) {
      throw new Error(`Collection ${collection} does not exist`);
    }

    for (const point of points) {
      coll.points.set(point.id, point);

      // Build sparse index if enabled
      if (point.sparseVector && this.sparseIndex.has(collection)) {
        const termIndex = this.sparseIndex.get(collection)!;
        // Note: In-memory adapter uses simplified sparse indexing
        // SparseVector.indices are mapped to terms via an internal dictionary
        // For simplicity, we store indices directly
        for (const idx of point.sparseVector.indices) {
          const termKey = `idx_${idx}`;
          if (!termIndex.has(termKey)) {
            termIndex.set(termKey, new Set());
          }
          termIndex.get(termKey)!.add(point.id);
        }
      }
    }

    console.log(`[InMemoryAdapter] Upserted ${points.length} points to ${collection}`);
  }

  /**
   * Delete vectors by IDs
   */
  async delete(collection: string, ids: string[]): Promise<void> {
    const coll = this.collections.get(collection);
    if (!coll) return;

    for (const id of ids) {
      const point = coll.points.get(id);
      if (point && point.sparseVector && this.sparseIndex.has(collection)) {
        // Remove from sparse index
        const termIndex = this.sparseIndex.get(collection)!;
        for (const idx of point.sparseVector.indices) {
          const termKey = `idx_${idx}`;
          termIndex.get(termKey)?.delete(id);
        }
      }
      coll.points.delete(id);
    }

    console.log(`[InMemoryAdapter] Deleted ${ids.length} points from ${collection}`);
  }

  /**
   * Delete vectors by filter
   */
  async deleteByFilter(collection: string, filter: MetadataFilter): Promise<number> {
    const coll = this.collections.get(collection);
    if (!coll) return 0;

    const idsToDelete: string[] = [];
    for (const [id, point] of coll.points) {
      if (this.matchesFilter(point.payload, filter)) {
        idsToDelete.push(id);
      }
    }

    await this.delete(collection, idsToDelete);
    return idsToDelete.length;
  }

  /**
   * Dense vector search (linear scan)
   */
  async searchDense(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    const coll = this.collections.get(collection);
    if (!coll || !query.vector) {
      return [];
    }

    const results: SearchResult[] = [];
    const threshold = query.threshold ?? 0;

    for (const [id, point] of coll.points) {
      if (!point.vector) continue;

      // Apply filter
      if (query.filter && !this.matchesFilter(point.payload, query.filter)) {
        continue;
      }

      const similarity = this.cosineSimilarity(query.vector, point.vector);
      if (similarity >= threshold) {
        results.push({
          id,
          score: similarity,
          payload: point.payload,
          matchSource: 'dense',
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, query.topK);
  }

  /**
   * Sparse vector search (term matching)
   */
  async searchSparse(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    const coll = this.collections.get(collection);
    const termIndex = this.sparseIndex.get(collection);
    if (!coll || !query.sparseVector || !termIndex) {
      return [];
    }

    // Calculate scores for each point based on sparse overlap
    const scoreMap = new Map<string, number>();

    for (let i = 0; i < query.sparseVector.indices.length; i++) {
      const queryIdx = query.sparseVector.indices[i]!;
      const queryWeight = query.sparseVector.values[i] ?? 1;
      const termKey = `idx_${queryIdx}`;

      const matchingIds = termIndex.get(termKey);
      if (matchingIds) {
        for (const id of matchingIds) {
          const point = coll.points.get(id);
          if (point && point.sparseVector && (!query.filter || this.matchesFilter(point.payload, query.filter))) {
            const pointIdx = point.sparseVector.indices.indexOf(queryIdx);
            if (pointIdx !== -1) {
              const pointWeight = point.sparseVector.values[pointIdx] ?? 1;
              const scoreIncrement = queryWeight * pointWeight;
              scoreMap.set(id, (scoreMap.get(id) ?? 0) + scoreIncrement);
            }
          }
        }
      }
    }

    // Convert to results
    const results: SearchResult[] = [];
    for (const [id, score] of scoreMap) {
      const point = coll.points.get(id);
      if (point) {
        results.push({
          id,
          score: this.normalizeSparseScore(score),
          payload: point.payload,
          matchSource: 'sparse',
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, query.topK);
  }

  /**
   * Hybrid search (dense + sparse combined)
   */
  async searchHybrid(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    // Perform both searches
    const denseResults = query.vector ? await this.searchDense(collection, query) : [];
    const sparseResults = query.sparseVector ? await this.searchSparse(collection, query) : [];

    // Simple fusion: merge and deduplicate by max score
    const fusedMap = new Map<string, SearchResult>();

    for (const result of denseResults) {
      fusedMap.set(result.id, { ...result, matchSource: 'dense' });
    }

    for (const result of sparseResults) {
      const existing = fusedMap.get(result.id);
      if (existing) {
        // Both matched - mark as hybrid
        existing.score = Math.max(existing.score, result.score);
        existing.matchSource = 'hybrid';
      } else {
        fusedMap.set(result.id, result);
      }
    }

    const results = Array.from(fusedMap.values());
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, query.topK);
  }

  /**
   * Get collection statistics
   */
  async getStats(collection: string): Promise<CollectionStats> {
    const coll = this.collections.get(collection);
    if (!coll) {
      return {
        name: collection,
        vectorCount: 0,
      };
    }

    let denseCount = 0;
    let sparseCount = 0;

    for (const point of coll.points.values()) {
      if (point.vector) denseCount++;
      if (point.sparseVector) sparseCount++;
    }

    return {
      name: collection,
      vectorCount: coll.points.size,
      denseVectorCount: denseCount,
      sparseVectorCount: sparseCount,
      dimension: coll.config.dimension,
      indexStatus: 'green',
    };
  }

  /**
   * Get a single point by ID
   */
  async getPoint(collection: string, id: string): Promise<VectorPoint | null> {
    const coll = this.collections.get(collection);
    if (!coll) return null;

    return coll.points.get(id) ?? null;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      magnitudeA += a[i]! * a[i]!;
      magnitudeB += b[i]! * b[i]!;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Normalization sparse score to [0, 1] range
   */
  private normalizeSparseScore(score: number): number {
    // Simple normalization: scale by max possible overlap
    return Math.min(score / 10, 1);
  }

  /**
   * Check if payload matches filter
   */
  private matchesFilter(payload: VectorPayload, filter: MetadataFilter): boolean {
    if (filter.documentId && payload.documentId !== filter.documentId) {
      return false;
    }

    if (filter.minQuality !== undefined && payload.qualityScore !== undefined && payload.qualityScore < filter.minQuality) {
      return false;
    }

    if (filter.maxQuality !== undefined && payload.qualityScore !== undefined && payload.qualityScore > filter.maxQuality) {
      return false;
    }

    if (filter.pageNumbers && payload.pageNumber !== undefined) {
      if (!filter.pageNumbers.includes(payload.pageNumber)) {
        return false;
      }
    }

    if (filter.modality && payload.modality !== filter.modality) {
      return false;
    }

    if (filter.contentTypes && payload.contentType !== undefined && !filter.contentTypes.includes(payload.contentType)) {
      return false;
    }

    if (filter.level && payload.level !== filter.level) {
      return false;
    }

    if (filter.parentId && payload.parentId !== filter.parentId) {
      return false;
    }

    return true;
  }
}

/**
 * Create in-memory vector store adapter
 */
export function createInMemoryVectorStoreAdapter(): InMemoryVectorStoreAdapter {
  return new InMemoryVectorStoreAdapter();
}