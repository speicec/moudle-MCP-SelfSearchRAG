import { pipeline, env } from '@xenova/transformers';
import type { TextEmbeddingModel } from './embedding-model.js';
import type { TextBlock, EmbeddingVector } from '../core/types.js';

/**
 * Configuration for local embedding models
 */
export interface LocalEmbeddingConfig {
  modelId: string;
  dimension: number;
  quantized: boolean;
  cacheDir?: string;
}

/**
 * Error types for local embedding
 */
export class LocalEmbeddingError extends Error {
  constructor(message: string, public code: string, public retryable: boolean = false) {
    super(message);
    this.name = 'LocalEmbeddingError';
  }
}

/**
 * Default configurations for supported local models
 */
export const LOCAL_MODEL_CONFIGS: Record<string, LocalEmbeddingConfig> = {
  'multilingual-e5-small': {
    modelId: 'Xenova/multilingual-e5-small',
    dimension: 384,
    quantized: true,
  },
  'multilingual-e5-base': {
    modelId: 'Xenova/multilingual-e5-base',
    dimension: 768,
    quantized: true,
  },
  'all-MiniLM-L6-v2': {
    modelId: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384,
    quantized: true,
  },
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 60000, // 60 seconds timeout for model loading
};

/**
 * Local text embedding service using transformers.js
 * Supports multilingual models including Chinese and English
 */
export class LocalTextEmbeddingService implements TextEmbeddingModel {
  private modelName: string;
  private config: LocalEmbeddingConfig;
  private extractor: Awaited<ReturnType<typeof pipeline<'feature-extraction'>>> | null = null;
  private initialized = false;
  private initializing = false;
  private initError: Error | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private maxCacheSize = 1000;
  private retryConfig = DEFAULT_RETRY_CONFIG;

  constructor(modelName?: string) {
    // Get model from environment or use default
    this.modelName = modelName
      ?? process.env.LOCAL_TEXT_MODEL
      ?? 'multilingual-e5-small';

    // Get config for the model
    this.config = LOCAL_MODEL_CONFIGS[this.modelName]
      ?? LOCAL_MODEL_CONFIGS['multilingual-e5-small']!;

    // Configure cache directory if specified
    if (process.env.TRANSFORMERS_CACHE) {
      env.cacheDir = process.env.TRANSFORMERS_CACHE;
    }

    // Configure mirror for China users (if HF_ENDPOINT is set)
    if (process.env.HF_ENDPOINT) {
      env.remoteHost = process.env.HF_ENDPOINT;
      console.log(`[LocalTextEmbedding] Using HuggingFace mirror: ${env.remoteHost}`);
    }

    // Disable remote models for offline support after caching
    if (process.env.LOCAL_FILES_ONLY === 'true') {
      env.allowRemoteModels = false;
    }
  }

  /**
   * Initialize the embedding model with retry logic
   * Downloads model on first use, then uses cached version
   */
  private async initialize(): Promise<void> {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;
    this.initError = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        console.log(`[LocalTextEmbedding] Loading model (attempt ${attempt}/${this.retryConfig.maxRetries}): ${this.config.modelId}`);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new LocalEmbeddingError(
            `Model loading timeout (${this.retryConfig.timeoutMs}ms)`,
            'TIMEOUT',
            true
          )), this.retryConfig.timeoutMs);
        });

        // Load model with timeout
        this.extractor = await Promise.race([
          pipeline('feature-extraction', this.config.modelId, {
            quantized: this.config.quantized,
            progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
              if (progress.status === 'downloading') {
                const percent = progress.progress ? `${Math.round(progress.progress)}%` : 'starting';
                const file = progress.file ?? 'model';
                console.log(`[LocalTextEmbedding] Downloading ${file}: ${percent}`);
              } else if (progress.status === 'loading') {
                console.log(`[LocalTextEmbedding] Loading model into memory...`);
              }
            },
          }),
          timeoutPromise,
        ]);

        this.initialized = true;
        const duration = Date.now() - startTime;
        console.log(`[LocalTextEmbedding] Model loaded successfully (${duration}ms, dimension: ${this.config.dimension})`);
        return; // Success, exit retry loop
      } catch (error) {
        const duration = Date.now() - startTime;
        const isRetryable = error instanceof LocalEmbeddingError && error.retryable;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(`[LocalTextEmbedding] Failed to load model (${duration}ms): ${errorMessage}`);

        if (isRetryable && attempt < this.retryConfig.maxRetries) {
          console.log(`[LocalTextEmbedding] Retrying in ${this.retryConfig.retryDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelayMs));
        } else {
          this.initError = new LocalEmbeddingError(
            `Failed to initialize embedding model after ${attempt} attempts: ${errorMessage}`,
            'INIT_FAILED',
            false
          );
          this.initializing = false;
          throw this.initError;
        }
      }
    }

    this.initializing = false;
  }

  /**
   * Ensure model is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initError) {
      throw this.initError;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.extractor) {
      throw new LocalEmbeddingError('Embedding model not initialized', 'NOT_INITIALIZED', false);
    }
  }

  /**
   * Get model identifier
   */
  getId(): string {
    return this.modelName;
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
    return 512;
  }

  /**
   * Check if model supports images (text models don't)
   */
  supportsImages(): boolean {
    return false;
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Check if initialization failed
   */
  hasError(): boolean {
    return this.initError !== null;
  }

  /**
   * Get initialization error
   */
  getError(): Error | null {
    return this.initError;
  }

  /**
   * Generate embedding for single text
   */
  async embedText(text: string): Promise<number[]> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new LocalEmbeddingError('Cannot embed empty text', 'EMPTY_INPUT', false);
    }

    // Check cache first
    const cacheKey = text.trim();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Generate embedding
      const output = await this.extractor!(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      const vector = Array.from(output.data as Float32Array);

      const duration = Date.now() - startTime;
      console.log(`[LocalTextEmbedding] Generated embedding (${duration}ms, dim: ${vector.length})`);

      // Cache the result
      if (this.embeddingCache.size < this.maxCacheSize) {
        this.embeddingCache.set(cacheKey, vector);
      }

      return vector;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new LocalEmbeddingError(`Failed to generate embedding: ${errorMessage}`, 'EMBED_FAILED', true);
    }
  }

  /**
   * Generate embeddings for multiple texts with memory monitoring
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    // Validate inputs
    for (const text of texts) {
      if (!text || text.trim().length === 0) {
        throw new LocalEmbeddingError('Cannot embed empty text', 'EMPTY_INPUT', false);
      }
    }

    await this.ensureInitialized();

    // Memory monitoring for large batches
    const BATCH_SIZE_LIMIT = 100; // Process in chunks to avoid memory issues
    const results: number[][] = [];

    // Process in chunks if batch is large
    for (let chunkStart = 0; chunkStart < texts.length; chunkStart += BATCH_SIZE_LIMIT) {
      const chunkEnd = Math.min(chunkStart + BATCH_SIZE_LIMIT, texts.length);
      const chunk = texts.slice(chunkStart, chunkEnd);

      // Check memory before processing
      const memBefore = process.memoryUsage();
      if (memBefore.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
        console.warn(`[LocalTextEmbedding] High memory usage (${Math.round(memBefore.heapUsed / 1024 / 1024)}MB), clearing cache`);
        this.clearCache();
      }

      const chunkResults = await this.processChunk(chunk);
      results.push(...chunkResults);

      // Force garbage collection hint between chunks
      if (global.gc && chunkEnd < texts.length) {
        global.gc();
      }
    }

    return results;
  }

  /**
   * Process a chunk of texts
   */
  private async processChunk(texts: string[]): Promise<number[][]> {
    // Check cache for each text
    const results: (number[] | undefined)[] = new Array(texts.length);
    const uncached: { index: number; text: string }[] = [];

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = texts[i]!.trim();
      const cached = this.embeddingCache.get(cacheKey);
      if (cached) {
        results[i] = cached;
      } else {
        uncached.push({ index: i, text: texts[i]! });
      }
    }

    // Process uncached texts in batch
    if (uncached.length > 0) {
      const startTime = Date.now();

      try {
        const batchOutputs = await this.extractor!(
          uncached.map(u => u.text),
          {
            pooling: 'mean',
            normalize: true,
          }
        );

        // Process batch results
        if (uncached.length === 1) {
          const vector = Array.from(batchOutputs.data as Float32Array);
          results[uncached[0]!.index] = vector;
          if (this.embeddingCache.size < this.maxCacheSize) {
            this.embeddingCache.set(uncached[0]!.text.trim(), vector);
          }
        } else {
          const data = batchOutputs.data as Float32Array;
          const dim = batchOutputs.dims[batchOutputs.dims.length - 1] ?? this.config.dimension;
          for (let i = 0; i < uncached.length; i++) {
            const start = i * dim;
            const vector = Array.from(data.slice(start, start + dim));
            results[uncached[i]!.index] = vector;
            if (this.embeddingCache.size < this.maxCacheSize) {
              this.embeddingCache.set(uncached[i]!.text.trim(), vector);
            }
          }
        }

        const duration = Date.now() - startTime;
        console.log(`[LocalTextEmbedding] Batch embedding generated ${uncached.length} vectors (${duration}ms)`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new LocalEmbeddingError(`Failed to generate batch embeddings: ${errorMessage}`, 'BATCH_FAILED', true);
      }
    }

    // Ensure all results are defined
    return results.filter((r): r is number[] => r !== undefined);
  }

  /**
   * Generate embedding for text block
   */
  async embedBlock(block: TextBlock): Promise<EmbeddingVector> {
    const vector = await this.embedText(block.content);

    return {
      id: `local_text_${block.blockIndex}_${Date.now()}`,
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
    const vectors = await this.embedTexts(blocks.map(b => b.content));

    return blocks.map((block, i) => ({
      id: `local_text_${block.blockIndex}_${Date.now()}_${i}`,
      vector: vectors[i]!,
      dimension: this.config.dimension,
      modality: 'text',
      createdAt: new Date(),
    }));
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    console.log('[LocalTextEmbedding] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.embeddingCache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * Set maximum cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    // Trim cache if needed
    if (this.embeddingCache.size > size) {
      const keys = Array.from(this.embeddingCache.keys()).slice(0, this.embeddingCache.size - size);
      for (const key of keys) {
        this.embeddingCache.delete(key);
      }
    }
  }
}

/**
 * Create local text embedding service
 */
export function createLocalTextEmbeddingService(modelName?: string): LocalTextEmbeddingService {
  return new LocalTextEmbeddingService(modelName);
}