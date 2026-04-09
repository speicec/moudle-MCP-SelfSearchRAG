import type { TextEmbeddingModel, EmbeddingModelConfig } from './embedding-model.js';
import type { TextBlock, EmbeddingVector } from '../core/types.js';
import { DEFAULT_EMBEDDING_CONFIG } from './embedding-model.js';

/**
 * Text embedding service implementation
 */
export class TextEmbeddingService implements TextEmbeddingModel {
  private config: EmbeddingModelConfig;
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(config?: Partial<EmbeddingModelConfig>) {
    this.config = {
      ...DEFAULT_EMBEDDING_CONFIG.textModel,
      ...config,
    };
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = process.env.OPENAI_API_BASE_URL ?? 'https://api.openai.com/v1';
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
   * Get maximum input length
   */
  getMaxInputLength(): number {
    return this.config.maxInputLength;
  }

  /**
   * Check if model supports images (text models don't)
   */
  supportsImages(): boolean {
    return false;
  }

  /**
   * Generate embedding for single text
   */
  async embedText(text: string): Promise<number[]> {
    // Truncate if necessary
    const truncated = this.truncateText(text);

    // Mock implementation - in production, call actual embedding API
    // For OpenAI: POST to /embeddings
    const embedding = await this.generateEmbedding(truncated);

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.embedText(text))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate embedding for text block
   */
  async embedBlock(block: TextBlock): Promise<EmbeddingVector> {
    const vector = await this.embedText(block.content);

    return {
      id: `text_${block.blockIndex}_${Date.now()}`,
      vector,
      dimension: this.config.dimension,
      modality: 'text',
      createdAt: new Date(),
    };
  }

  /**
   * Generate embeddings for text blocks
   */
  async embedBlocks(blocks: TextBlock[]): Promise<EmbeddingVector[]> {
    const results: EmbeddingVector[] = [];

    for (let i = 0; i < blocks.length; i += this.config.batchSize) {
      const batch = blocks.slice(i, i + this.config.batchSize);
      const vectors = await this.embedTexts(batch.map(b => b.content));

      for (let j = 0; j < batch.length; j++) {
        results.push({
          id: `text_${batch[j]!.blockIndex}_${Date.now()}`,
          vector: vectors[j]!,
          dimension: this.config.dimension,
          modality: 'text',
          createdAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Truncate text to maximum length
   */
  private truncateText(text: string): string {
    // Simple character-based truncation
    // In production, use tokenization
    if (text.length > this.config.maxInputLength * 4) {
      return text.slice(0, this.config.maxInputLength * 4);
    }
    return text;
  }

  /**
   * Generate embedding via API
   * Mock implementation - replace with actual API call
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // In production, this would call:
    // POST https://api.openai.com/v1/embeddings
    // {
    //   "model": "text-embedding-3-small",
    //   "input": text
    // }

    // Mock: generate deterministic pseudo-embedding based on text hash
    // This is for development/testing only
    const dimension = this.config.dimension;
    const vector: number[] = [];

    // Generate pseudo-random but deterministic vector
    let seed = this.hashCode(text);
    for (let i = 0; i < dimension; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      vector.push((seed / 0x7fffffff) * 2 - 1);
    }

    // Normalize vector
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
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}

/**
 * Create text embedding service
 */
export function createTextEmbeddingService(
  config?: Partial<EmbeddingModelConfig>
): TextEmbeddingService {
  return new TextEmbeddingService(config);
}