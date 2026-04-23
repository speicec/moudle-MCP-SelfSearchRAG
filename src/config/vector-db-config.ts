/**
 * Vector Database Configuration Types
 *
 * Centralized type definitions for vector database integration
 */

import type { SparseVector } from '../retrieval/vector-store-adapter.js';

/**
 * Qdrant connection configuration
 */
export interface QdrantConfig {
  /** Qdrant server URL */
  url: string;
  /** API key for authentication */
  apiKey?: string | undefined;
  /** Connection timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Default Qdrant configuration values
 */
export const DEFAULT_QDRANT_CONFIG: QdrantConfig = {
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY ?? undefined,
  timeoutMs: 10000,
};

/**
 * Collection configuration for text chunks
 */
export interface TextCollectionConfig {
  /** Dense vector dimension */
  dimension: number;
  /** HNSW configuration */
  hnsw: {
    m: number;
    efConstruct: number;
  };
  /** Enable sparse vector support */
  enableSparse: boolean;
}

/**
 * Collection configuration for image chunks
 */
export interface ImageCollectionConfig {
  /** Dense vector dimension */
  dimension: number;
  /** HNSW configuration */
  hnsw: {
    m: number;
    efConstruct: number;
  };
}

/**
 * Hybrid retrieval RRF configuration
 */
export interface RRFConfig {
  /** RRF k parameter */
  k: number;
  /** Dense search topK */
  denseTopK: number;
  /** Sparse search topK */
  sparseTopK: number;
  /** Fallback parent sparse topK */
  fallbackTopK: number;
}

/**
 * Hybrid retrieval configuration
 */
export interface HybridRetrievalConfig {
  /** Enable hybrid mode */
  enabled: boolean;
  /** Dense model selection */
  denseModel: 'bge-m3' | 'multilingual-e5-large';
  /** Sparse minimum weight threshold */
  sparseMinWeight: number;
  /** RRF configuration */
  rrf: RRFConfig;
}

/**
 * Default collection configurations
 */
export const DEFAULT_COLLECTION_CONFIG = {
  text: {
    dimension: 1024,
    hnsw: { m: 16, efConstruct: 100 },
    enableSparse: true,
  },
  parent: {
    enableSparse: true,
  },
  image: {
    dimension: 512,
    hnsw: { m: 12, efConstruct: 80 },
  },
};

/**
 * Default hybrid configuration
 */
export const DEFAULT_HYBRID_CONFIG: HybridRetrievalConfig = {
  enabled: process.env.HYBRID_RETRIEVAL_ENABLED === 'true',
  denseModel: 'bge-m3',
  sparseMinWeight: 0.01,
  rrf: {
    k: 60,
    denseTopK: 50,
    sparseTopK: 50,
    fallbackTopK: 20,
  },
};

/**
 * Payload storage configuration
 * Controls whether chunk content is stored in Qdrant payload for recovery
 */
export interface PayloadStorageConfig {
  /** Store chunk content in Qdrant payload (enables recovery from Qdrant) */
  storeContentInPayload: boolean;
  /** Maximum content size to store (in bytes, default 10KB) */
  maxContentSizeBytes: number;
}

/**
 * Default payload storage configuration
 */
export const DEFAULT_PAYLOAD_STORAGE_CONFIG: PayloadStorageConfig = {
  storeContentInPayload: process.env.STORE_CONTENT_IN_PAYLOAD === 'true',
  maxContentSizeBytes: parseInt(process.env.MAX_PAYLOAD_CONTENT_SIZE ?? '10240', 10),
};