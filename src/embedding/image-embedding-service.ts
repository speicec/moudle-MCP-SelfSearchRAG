import type { ImageEmbeddingModel, EmbeddingModelConfig } from './embedding-model.js';
import type { ImageBlock, EmbeddingVector } from '../core/types.js';
import { DEFAULT_EMBEDDING_CONFIG } from './embedding-model.js';

/**
 * Image embedding service implementation
 */
export class ImageEmbeddingService implements ImageEmbeddingModel {
  private config: EmbeddingModelConfig;
  private modelEndpoint: string | undefined;

  constructor(config?: Partial<EmbeddingModelConfig>) {
    this.config = {
      ...DEFAULT_EMBEDDING_CONFIG.imageModel!,
      ...config,
    };
    this.modelEndpoint = process.env.IMAGE_EMBEDDING_ENDPOINT;
  }

  /**
   * Get model identifier
   */
  getId(): string {
    return this.config.modelId;
  }

  /**
   * Get embedding dimension
   */
  getDimension(): number {
    return this.config.dimension;
  }

  /**
   * Get maximum input length (for CLIP, this is token count)
   */
  getMaxInputLength(): number {
    return this.config.maxInputLength;
  }

  /**
   * Check if model supports images
   */
  supportsImages(): boolean {
    return true;
  }

  /**
   * Generate embedding for text (using CLIP text encoder)
   */
  async embedText(text: string): Promise<number[]> {
    // For CLIP, text is encoded using the text encoder
    // This is useful for cross-modal retrieval
    const embedding = await this.generateTextEmbedding(text);
    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embedText(text)));
  }

  /**
   * Generate embedding for image block
   */
  async embedImage(image: ImageBlock): Promise<EmbeddingVector> {
    const content = image.content;

    let buffer: Buffer;
    if (typeof content === 'string') {
      // Assume base64 encoded
      buffer = Buffer.from(content, 'base64');
    } else {
      buffer = content;
    }

    const vector = await this.embedImageBuffer(buffer);

    return {
      id: `image_${image.blockIndex}_${Date.now()}`,
      vector,
      dimension: this.config.dimension,
      modality: 'image',
      createdAt: new Date(),
    };
  }

  /**
   * Generate embeddings for multiple images
   */
  async embedImages(images: ImageBlock[]): Promise<EmbeddingVector[]> {
    const results: EmbeddingVector[] = [];

    for (let i = 0; i < images.length; i += this.config.batchSize) {
      const batch = images.slice(i, i + this.config.batchSize);
      const vectors = await Promise.all(
        batch.map(img => this.embedImage(img))
      );
      results.push(...vectors);
    }

    return results;
  }

  /**
   * Generate embedding for image buffer
   */
  async embedImageBuffer(buffer: Buffer): Promise<number[]> {
    // Mock implementation - in production, call CLIP or similar model
    const embedding = await this.generateImageEmbedding(buffer);
    return embedding;
  }

  /**
   * Generate text embedding (CLIP text encoder)
   * Mock implementation
   */
  private async generateTextEmbedding(text: string): Promise<number[]> {
    // In production, call CLIP text encoder
    // For now, generate deterministic pseudo-embedding
    const dimension = this.config.dimension;
    const vector: number[] = [];

    let seed = this.hashCode(text + '_text');
    for (let i = 0; i < dimension; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      vector.push((seed / 0x7fffffff) * 2 - 1);
    }

    return this.normalizeVector(vector);
  }

  /**
   * Generate image embedding (CLIP image encoder)
   * Mock implementation
   */
  private async generateImageEmbedding(buffer: Buffer): Promise<number[]> {
    // In production, this would:
    // 1. Preprocess image (resize, normalize)
    // 2. Run through CLIP vision encoder
    // 3. Return the embedding

    // Mock: generate pseudo-embedding based on image hash
    const dimension = this.config.dimension;
    const vector: number[] = [];

    // Use image data to generate seed
    const seed = this.hashCode(buffer.toString('base64').slice(0, 1000));

    for (let i = 0; i < dimension; i++) {
      const seedVal = (seed * (i + 1) * 1103515245 + 12345) & 0x7fffffff;
      vector.push((seedVal / 0x7fffffff) * 2 - 1);
    }

    return this.normalizeVector(vector);
  }

  /**
   * Generate hash code from string
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) {
      return vector;
    }

    return vector.map(val => val / magnitude);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EmbeddingModelConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Set model endpoint
   */
  setModelEndpoint(endpoint: string): void {
    this.modelEndpoint = endpoint;
  }
}

/**
 * Create image embedding service
 */
export function createImageEmbeddingService(
  config?: Partial<EmbeddingModelConfig>
): ImageEmbeddingService {
  return new ImageEmbeddingService(config);
}