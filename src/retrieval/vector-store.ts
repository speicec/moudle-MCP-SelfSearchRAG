import type { EmbeddingResult, EmbeddingMetadata } from '../core/context.js';
import type { SearchResult, QueryOptions, QueryFilters } from '../core/types.js';

/**
 * Vector store interface
 */
export interface VectorStore {
  /**
   * Add embeddings to the store
   */
  add(embeddings: EmbeddingResult[]): Promise<void>;

  /**
   * Remove embeddings by document ID
   */
  removeByDocumentId(documentId: string): Promise<number>;

  /**
   * Update embeddings for a document
   */
  update(documentId: string, embeddings: EmbeddingResult[]): Promise<void>;

  /**
   * Search for similar vectors
   */
  search(vector: number[], options?: QueryOptions): Promise<SearchResult[]>;

  /**
   * Get embedding by ID
   */
  get(id: string): Promise<EmbeddingResult | null>;

  /**
   * Get all embeddings for a document
   */
  getByDocumentId(documentId: string): Promise<EmbeddingResult[]>;

  /**
   * Count total embeddings
   */
  count(): Promise<number>;

  /**
   * Clear all embeddings
   */
  clear(): Promise<void>;

  /**
   * Get store statistics
   */
  getStats(): Promise<VectorStoreStats>;
}

/**
 * Vector store statistics
 */
export interface VectorStoreStats {
  totalVectors: number;
  totalDocuments: number;
  vectorDimension: number;
  modalityCounts: {
    text: number;
    image: number;
  };
  indexSizeBytes: number;
}

/**
 * Index entry
 */
interface IndexEntry {
  id: string;
  vector: number[];
  chunkId: string;
  modality: 'text' | 'image';
  documentId: string;
  pageNumber?: number | undefined;
  metadata: EmbeddingMetadata;
}

/**
 * In-memory vector store implementation
 */
export class InMemoryVectorStore implements VectorStore {
  private index: Map<string, IndexEntry> = new Map();
  private documentIndex: Map<string, Set<string>> = new Map();
  private dimension: number = 0;

  /**
   * Add embeddings to store
   */
  async add(embeddings: EmbeddingResult[]): Promise<void> {
    for (const embedding of embeddings) {
      const entry: IndexEntry = {
        id: embedding.id,
        vector: embedding.vector,
        chunkId: embedding.chunkId,
        modality: embedding.modality,
        documentId: embedding.metadata.sourceDocumentId,
        pageNumber: embedding.metadata.pageNumber,
        metadata: embedding.metadata,
      };

      this.index.set(embedding.id, entry);
      this.dimension = embedding.vector.length;

      // Update document index
      if (!this.documentIndex.has(entry.documentId)) {
        this.documentIndex.set(entry.documentId, new Set());
      }
      this.documentIndex.get(entry.documentId)!.add(embedding.id);
    }
  }

  /**
   * Remove embeddings by document ID
   */
  async removeByDocumentId(documentId: string): Promise<number> {
    const ids = this.documentIndex.get(documentId);
    if (!ids) return 0;

    let removed = 0;
    for (const id of ids) {
      if (this.index.delete(id)) {
        removed++;
      }
    }

    this.documentIndex.delete(documentId);
    return removed;
  }

  /**
   * Update embeddings for a document
   */
  async update(documentId: string, embeddings: EmbeddingResult[]): Promise<void> {
    await this.removeByDocumentId(documentId);
    await this.add(embeddings);
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(vector: number[], options?: QueryOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const threshold = options?.threshold ?? 0;
    const topK = options?.topK ?? 10;

    for (const [id, entry] of this.index) {
      // Apply filters if specified
      if (options?.filters && !this.matchesFilters(entry, options.filters)) {
        continue;
      }

      // Exclude images if not requested
      if (!options?.includeImages && entry.modality === 'image') {
        continue;
      }

      const similarity = this.cosineSimilarity(vector, entry.vector);

      if (similarity >= threshold) {
        results.push({
          id,
          score: similarity,
          content: '', // Content would be fetched separately
          sourceDocumentId: entry.documentId,
          pageNumber: entry.pageNumber,
          modality: entry.modality,
          metadata: {
            chunkIndex: parseInt(entry.chunkId),
            contentType: entry.metadata.contentType as string,
          },
        });
      }
    }

    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Get embedding by ID
   */
  async get(id: string): Promise<EmbeddingResult | null> {
    const entry = this.index.get(id);
    if (!entry) return null;

    return {
      id: entry.id,
      vector: entry.vector,
      chunkId: entry.chunkId,
      modality: entry.modality,
      metadata: entry.metadata as EmbeddingResult['metadata'],
    };
  }

  /**
   * Get embeddings by document ID
   */
  async getByDocumentId(documentId: string): Promise<EmbeddingResult[]> {
    const ids = this.documentIndex.get(documentId);
    if (!ids) return [];

    const results: EmbeddingResult[] = [];
    for (const id of ids) {
      const result = await this.get(id);
      if (result) results.push(result);
    }

    return results;
  }

  /**
   * Count total embeddings
   */
  async count(): Promise<number> {
    return this.index.size;
  }

  /**
   * Clear all embeddings
   */
  async clear(): Promise<void> {
    this.index.clear();
    this.documentIndex.clear();
    this.dimension = 0;
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<VectorStoreStats> {
    let textCount = 0;
    let imageCount = 0;

    for (const entry of this.index.values()) {
      if (entry.modality === 'text') textCount++;
      else imageCount++;
    }

    return {
      totalVectors: this.index.size,
      totalDocuments: this.documentIndex.size,
      vectorDimension: this.dimension,
      modalityCounts: { text: textCount, image: imageCount },
      indexSizeBytes: this.index.size * this.dimension * 8,
    };
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
   * Check if entry matches filters
   */
  private matchesFilters(entry: IndexEntry, filters: QueryFilters): boolean {
    if (filters.documentIds && !filters.documentIds.includes(entry.documentId)) {
      return false;
    }

    if (filters.pageNumbers && entry.pageNumber &&
        !filters.pageNumbers.includes(entry.pageNumber)) {
      return false;
    }

    if (filters.contentTypes && entry.metadata.contentType) {
      if (!filters.contentTypes.includes(entry.metadata.contentType as string)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Create in-memory vector store
 */
export function createVectorStore(): VectorStore {
  return new InMemoryVectorStore();
}