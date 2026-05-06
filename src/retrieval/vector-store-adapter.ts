/**
 * VectorStoreAdapter - Abstract interface for vector storage
 *
 * Provides a unified interface for different vector store implementations:
 * - Qdrant: Production-grade HNSW + Sparse indexing
 * - InMemory: Local testing fallback
 *
 * Supports:
 * - Dense vectors (HNSW indexing)
 * - Sparse vectors (keyword matching)
 * - Metadata filtering (documentId, qualityScore, pageNumber)
 * - Document-level metadata (documentYear, documentTitle, guidelineSource) for GRADE evaluation
 */

/**
 * Vector point for insertion
 */
export interface VectorPoint {
  id: string;
  /** Dense vector (semantic search) */
  vector?: number[] | undefined;
  /** Sparse vector (keyword matching) - term indices and weights */
  sparseVector?: SparseVector | undefined;
  /** Metadata payload */
  payload: VectorPayload;
}

/**
 * Sparse vector representation
 * Uses indices (internal term IDs) and values (weights)
 */
export interface SparseVector {
  indices: number[];
  values: number[];
}

/**
 * Alternative sparse vector format using term-weight pairs
 */
export interface SparseVectorMap {
  [term: string]: number;
}

/**
 * Vector payload metadata
 *
 * Includes both chunk-level metadata (position, contentType) and document-level
 * metadata (documentYear, documentTitle, guidelineSource) for GRADE evidence evaluation.
 */
export interface VectorPayload {
  documentId: string;
  chunkId: string;
  /** Parent chunk ID for Small-to-Big expansion */
  parentId?: string | undefined;
  /** Chunk level: small, parent, or image */
  level: 'small' | 'parent' | 'image';
  /** Content modality */
  modality: 'text' | 'image';
  /** Quality score (0-1) */
  qualityScore?: number | undefined;
  /** Page number for filtering */
  pageNumber?: number | undefined;
  /** Content type (text, table, formula, etc.) */
  contentType?: string | undefined;
  /** Position in source document */
  position?: {
    start: number;
    end: number;
  } | undefined;
  /** Child chunk IDs (only for parent chunks) */
  childIds?: string[] | undefined;
  /** VLM text description (only for image chunks) */
  vlmText?: string | undefined;
  /** Block type (figure, table, formula, image - for image chunks) */
  blockType?: 'figure' | 'table' | 'formula' | 'image' | undefined;
  /** Chunk content for recovery from Qdrant (optional, configurable) */
  content?: string | undefined;
  /** Document publication year for GRADE evidence evaluation */
  documentYear?: number | undefined;
  /** Document title for citation display and literature type classification */
  documentTitle?: string | undefined;
  /** Document author for source identification */
  documentAuthor?: string | undefined;
  /** Medical guideline source (ADA, KDIGO, ESC, CDS, etc.) for authority classification */
  guidelineSource?: string | undefined;
}

/**
 * Collection configuration
 */
export interface CollectionConfig {
  /** Vector dimension */
  dimension: number;
  /** Distance metric */
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  /** HNSW parameters */
  hnsw?: {
    /** Number of connections per node */
    m: number;
    /** Search width during construction */
    efConstruct: number;
  };
  /** Enable sparse vector support */
  enableSparse?: boolean;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  /** Dense query vector */
  vector?: number[];
  /** Sparse query vector */
  sparseVector?: SparseVector;
  /** Number of results to return */
  topK: number;
  /** Minimum similarity threshold */
  threshold?: number;
  /** Metadata filter */
  filter?: MetadataFilter;
  /** HNSW search parameter (dynamic ef) */
  ef?: number;
}

/**
 * Metadata filter conditions
 */
export interface MetadataFilter {
  /** Filter by document ID */
  documentId?: string;
  /** Filter by minimum quality score */
  minQuality?: number;
  /** Filter by maximum quality score */
  maxQuality?: number;
  /** Filter by page numbers (IN semantics) */
  pageNumbers?: number[];
  /** Filter by modality */
  modality?: 'text' | 'image';
  /** Filter by content types */
  contentTypes?: string[];
  /** Filter by chunk level */
  level?: 'small' | 'parent';
  /** Filter by parent ID */
  parentId?: string;
}

/**
 * Search result from vector store
 */
export interface SearchResult {
  /** Result ID */
  id: string;
  /** Similarity score */
  score: number;
  /** Result payload */
  payload: VectorPayload;
  /** Source of the match (dense, sparse, or both) */
  matchSource?: 'dense' | 'sparse' | 'hybrid';
}

/**
 * Collection statistics
 */
export interface CollectionStats {
  /** Collection name */
  name: string;
  /** Total vector count */
  vectorCount: number;
  /** Number of points with dense vectors */
  denseVectorCount?: number | undefined;
  /** Number of points with sparse vectors */
  sparseVectorCount?: number | undefined;
  /** Vector dimension */
  dimension?: number | undefined;
  /** Index status */
  indexStatus?: 'green' | 'yellow' | 'red' | undefined;
}

/**
 * VectorStoreAdapter interface
 * Abstract interface for different vector store implementations
 */
export interface VectorStoreAdapter {
  /**
   * Initialize the vector store
   * Creates collections and establishes connection
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the vector store
   * Closes connections and releases resources
   */
  shutdown(): Promise<void>;

  /**
   * Check if the vector store is ready
   */
  isReady(): boolean;

  /**
   * Create a collection with specified configuration
   */
  createCollection(name: string, config: CollectionConfig): Promise<void>;

  /**
   * Delete a collection
   */
  deleteCollection(name: string): Promise<void>;

  /**
   * Check if a collection exists
   */
  collectionExists(name: string): Promise<boolean>;

  /**
   * Upsert vectors into a collection
   * Supports both dense and sparse vectors
   */
  upsert(collection: string, points: VectorPoint[]): Promise<void>;

  /**
   * Delete vectors by IDs
   */
  delete(collection: string, ids: string[]): Promise<void>;

  /**
   * Delete vectors by metadata filter
   * Returns number of deleted vectors
   */
  deleteByFilter(collection: string, filter: MetadataFilter): Promise<number>;

  /**
   * Search for similar vectors (dense)
   */
  searchDense(collection: string, query: SearchQuery): Promise<SearchResult[]>;

  /**
   * Search for similar vectors (sparse)
   */
  searchSparse(collection: string, query: SearchQuery): Promise<SearchResult[]>;

  /**
   * Hybrid search (dense + sparse combined)
   */
  searchHybrid(collection: string, query: SearchQuery): Promise<SearchResult[]>;

  /**
   * Get collection statistics
   */
  getStats(collection: string): Promise<CollectionStats>;

  /**
   * Get a single point by ID
   */
  getPoint(collection: string, id: string): Promise<VectorPoint | null>;
}

/**
 * Collection names constants
 */
export const COLLECTION_NAMES = {
  /** Small chunks with Dense + Sparse vectors */
  TEXT_CHUNKS: 'text_chunks',
  /** Parent chunks with Sparse only (for fallback) */
  PARENT_CHUNKS: 'parent_chunks',
  /** Image chunks with Dense vectors (CLIP) */
  IMAGE_CHUNKS: 'image_chunks',
} as const;

/**
 * Default HNSW configurations
 */
export const DEFAULT_HNSW_CONFIG = {
  /** Text chunks (1024 dim, ~100K vectors) */
  TEXT: {
    m: 16,
    efConstruct: 100,
  },
  /** Parent chunks (sparse only, ~20K vectors) */
  PARENT: {
    m: 12,
    efConstruct: 80,
  },
  /** Image chunks (512 dim, ~10K vectors) */
  IMAGE: {
    m: 12,
    efConstruct: 80,
  },
} as const;

/**
 * Embedding dimensions
 */
export const EMBEDDING_DIMENSIONS = {
  /** bge-m3 dense vector dimension */
  TEXT_DENSE: 1024,
  /** CLIP image vector dimension */
  IMAGE_DENSE: 512,
} as const;