import type { EmbeddingVector, TextBlock, ImageBlock } from '../core/types.js';

/**
 * Embedding model configuration
 */
export interface EmbeddingModelConfig {
  modelId: string;
  dimension: number;
  maxInputLength: number;
  batchSize: number;
}

/**
 * Embedding model interface
 */
export interface EmbeddingModel {
  /**
   * Get model identifier
   */
  getId(): string;

  /**
   * Get embedding dimension
   */
  getDimension(): number;

  /**
   * Get maximum input length (tokens or characters)
   */
  getMaxInputLength(): number;

  /**
   * Generate embedding for text
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts
   */
  embedTexts(texts: string[]): Promise<number[][]>;

  /**
   * Check if model supports images
   */
  supportsImages(): boolean;
}

/**
 * Text embedding model interface
 */
export interface TextEmbeddingModel extends EmbeddingModel {
  /**
   * Generate embedding for text block
   */
  embedBlock(block: TextBlock): Promise<EmbeddingVector>;

  /**
   * Generate embeddings for text blocks
   */
  embedBlocks(blocks: TextBlock[]): Promise<EmbeddingVector[]>;
}

/**
 * Image embedding model interface
 */
export interface ImageEmbeddingModel extends EmbeddingModel {
  /**
   * Generate embedding for image
   */
  embedImage(image: ImageBlock): Promise<EmbeddingVector>;

  /**
   * Generate embeddings for images
   */
  embedImages(images: ImageBlock[]): Promise<EmbeddingVector[]>;

  /**
   * Generate embedding for image buffer
   */
  embedImageBuffer(buffer: Buffer): Promise<number[]>;
}

/**
 * Embedding service configuration
 */
export interface EmbeddingServiceConfig {
  textModel: EmbeddingModelConfig;
  imageModel?: EmbeddingModelConfig;
  cacheEnabled: boolean;
  maxCacheSize: number;
}

/**
 * Default embedding service configuration
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingServiceConfig = {
  textModel: {
    modelId: 'text-embedding-3-small',
    dimension: 1536,
    maxInputLength: 8191,
    batchSize: 100,
  },
  imageModel: {
    modelId: 'clip-vit-base-patch32',
    dimension: 512,
    maxInputLength: 77,
    batchSize: 32,
  },
  cacheEnabled: true,
  maxCacheSize: 10000,
};

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  id: string;
  content: string | Buffer;
  modality: 'text' | 'image';
  metadata?: Record<string, unknown>;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  id: string;
  vector: number[];
  dimension: number;
  modality: 'text' | 'image';
  modelId: string;
  processingTimeMs: number;
}

/**
 * Batch embedding request
 */
export interface BatchEmbeddingRequest {
  requests: EmbeddingRequest[];
  options?: BatchEmbeddingOptions;
}

/**
 * Batch embedding options
 */
export interface BatchEmbeddingOptions {
  parallel?: boolean;
  maxConcurrency?: number;
  failFast?: boolean;
}

/**
 * Batch embedding response
 */
export interface BatchEmbeddingResponse {
  responses: EmbeddingResponse[];
  totalProcessingTimeMs: number;
  errors: EmbeddingError[];
}

/**
 * Embedding error
 */
export interface EmbeddingError {
  requestId: string;
  message: string;
  code: string;
}

/**
 * Create embedding vector from response
 */
export function createEmbeddingVector(
  response: EmbeddingResponse,
  documentId: string,
  chunkId: string
): EmbeddingVector {
  return {
    id: response.id,
    vector: response.vector,
    dimension: response.dimension,
    modality: response.modality,
    createdAt: new Date(),
  };
}