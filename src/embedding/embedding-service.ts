import type { TextEmbeddingModel, EmbeddingModelConfig } from './embedding-model.js';
import type { TextBlock, EmbeddingVector } from '../core/types.js';
import { DEFAULT_EMBEDDING_CONFIG } from './embedding-model.js';

/**
 * Text embedding service implementation
 * Supports OpenAI-compatible embedding APIs
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

    // Support multiple environment variable formats
    // Priority: EMBEDDING_API_KEY > OPENAI_API_KEY
    this.apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;

    // Priority: EMBEDDING_API_BASE_URL > OPENAI_API_BASE_URL > default
    this.baseUrl = process.env.EMBEDDING_API_BASE_URL
      ?? process.env.OPENAI_API_BASE_URL
      ?? 'https://api.openai.com/v1';

    // Support custom model from environment
    if (process.env.EMBEDDING_MODEL) {
      this.config.modelId = process.env.EMBEDDING_MODEL;
    }
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
   * Check if API is configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get API base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Generate embedding for single text
   */
  async embedText(text: string): Promise<number[]> {
    // Truncate if necessary
    const truncated = this.truncateText(text);

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
   * Calls OpenAI-compatible embedding API for real semantic embeddings
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // If no API key, fall back to mock for development
    if (!this.apiKey) {
      console.warn('[TextEmbeddingService] No API key configured, using mock embedding (no semantic meaning)');
      return this.generateMockEmbedding(text);
    }

    const startTime = Date.now();

    try {
      console.log(`[TextEmbeddingService] Calling embedding API: ${this.baseUrl}/embeddings (model: ${this.config.modelId})`);

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.modelId,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        let errorMsg = `Embedding API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorData);
          errorMsg += ` - ${errorJson.error?.message || errorData}`;
        } catch {
          errorMsg += ` - ${errorData}`;
        }

        throw new Error(errorMsg);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
      };

      if (!data.data?.[0]?.embedding) {
        throw new Error('Invalid embedding API response: missing embedding data');
      }

      const duration = Date.now() - startTime;
      console.log(`[TextEmbeddingService] Embedding generated successfully (${duration}ms, dim: ${data.data[0].embedding.length})`);

      // Update dimension if different from config
      if (data.data[0].embedding.length !== this.config.dimension) {
        console.log(`[TextEmbeddingService] Updating dimension from ${this.config.dimension} to ${data.data[0].embedding.length}`);
        this.config.dimension = data.data[0].embedding.length;
      }

      return data.data[0].embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[TextEmbeddingService] API call failed (${duration}ms):`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Generate mock embedding for development/testing
   * WARNING: These embeddings have NO semantic meaning!
   */
  private generateMockEmbedding(text: string): number[] {
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