/**
 * HybridEmbeddingService - Dense + Sparse dual embedding
 *
 * Features:
 * - bge-m3 model support (1024 dense + sparse output)
 * - Dense vectors for semantic search
 * - Sparse vectors for keyword matching
 * - Low weight term filtering
 * - Batch processing support
 *
 * Usage:
 * - Small chunks: embedHybrid() -> Dense + Sparse
 * - Parent chunks: embedSparseOnly() -> Sparse only
 */

import { pipeline, env } from '@huggingface/transformers';
import type { SparseVector, SparseVectorMap } from '../retrieval/vector-store-adapter.js';

/**
 * Hybrid embedding result
 */
export interface HybridEmbeddingResult {
  /** Dense vector (1024 dimensions) */
  dense: number[];
  /** Sparse vector (term indices and weights) */
  sparse: SparseVector;
  /** Original text */
  text: string;
  /** Model ID */
  modelId: string;
}

/**
 * Sparse-only embedding result
 */
export interface SparseOnlyResult {
  sparse: SparseVector;
  text: string;
  modelId: string;
}

/**
 * Hybrid embedding model configuration
 */
export interface HybridModelConfig {
  modelId: string;
  denseDimension: number;
  quantized: boolean;
  sparseMinWeight: number;
  sparseMaxTerms: number;
}

/**
 * Supported hybrid models
 */
export const HYBRID_MODEL_CONFIGS: Record<string, HybridModelConfig> = {
  'bge-m3': {
    // modelId: 'BAAI/bge-m3',
    modelId: 'Xenova/bge-m3',
    denseDimension: 1024,
    quantized: true,
    sparseMinWeight: 0.01,
    sparseMaxTerms: 1000,
  },
};

/**
 * Default hybrid model
 */
export const DEFAULT_HYBRID_MODEL = 'bge-m3';

/**
 * Term to index mapping for sparse vectors
 * Maintained across all embeddings for consistency
 */
class TermIndexMapper {
  private termToIndex: Map<string, number> = new Map();
  private indexToTerm: Map<number, string> = new Map();
  private nextIndex = 0;

  getIndex(term: string): number {
    if (!this.termToIndex.has(term)) {
      const index = this.nextIndex++;
      this.termToIndex.set(term, index);
      this.indexToTerm.set(index, term);
    }
    return this.termToIndex.get(term)!;
  }

  getTerm(index: number): string | undefined {
    return this.indexToTerm.get(index);
  }

  getStats(): { termCount: number } {
    return { termCount: this.termToIndex.size };
  }

  clear(): void {
    this.termToIndex.clear();
    this.indexToTerm.clear();
    this.nextIndex = 0;
  }
}

/**
 * Global term mapper for sparse vectors
 */
const globalTermMapper = new TermIndexMapper();

/**
 * HybridEmbeddingService class
 */
export class HybridEmbeddingService {
  private modelName: string;
  private config: HybridModelConfig;
  private extractor: any = null;
  private initialized = false;
  private initializing = false;
  private initError: Error | null = null;
  private embeddingCache: Map<string, HybridEmbeddingResult> = new Map();
  private maxCacheSize = 500;
  private termMapper: TermIndexMapper;

  constructor(modelName?: string) {
    this.modelName = modelName
      ?? process.env.LOCAL_TEXT_MODEL
      ?? DEFAULT_HYBRID_MODEL;

    this.config = HYBRID_MODEL_CONFIGS[this.modelName]
      ?? HYBRID_MODEL_CONFIGS[DEFAULT_HYBRID_MODEL]!;

    this.termMapper = globalTermMapper;

    // Configure cache directory
    if (process.env.TRANSFORMERS_CACHE) {
      env.cacheDir = process.env.TRANSFORMERS_CACHE;
    }

    // Configure mirror for China users
    if (process.env.HF_ENDPOINT) {
      env.remoteHost = process.env.HF_ENDPOINT;
      console.log(`[HybridEmbedding] Using HuggingFace mirror: ${env.remoteHost}`);
    }
  }

  /**
   * Initialize the embedding model
   */
  private async initialize(): Promise<void> {
    if (this.initialized || this.initializing) return;

    this.initializing = true;
    this.initError = null;

    const startTime = Date.now();

    try {
      console.log(`[HybridEmbedding] Loading model: ${this.config.modelId}`);

      // Load model - @huggingface/transformers API
      this.extractor = await pipeline(
        'feature-extraction',
        this.config.modelId,
      );

      this.initialized = true;
      const duration = Date.now() - startTime;
      console.log(`[HybridEmbedding] Model loaded (${duration}ms, dense: ${this.config.denseDimension}d, sparse: supported)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[HybridEmbedding] Failed to load model: ${errorMessage}`);
      this.initError = new Error(`Failed to initialize hybrid embedding model: ${errorMessage}`);
      this.initializing = false;
      throw this.initError;
    }

    this.initializing = false;
  }

  /**
   * Ensure model is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initError) throw this.initError;
    if (!this.initialized) await this.initialize();
    if (!this.extractor) throw new Error('Hybrid embedding model not initialized');
  }

  /**
   * Get model identifier
   */
  getId(): string {
    return this.modelName;
  }

  /**
   * Get dense dimension
   */
  getDenseDimension(): number {
    return this.config.denseDimension;
  }

  /**
   * Check if ready
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
   * Generate hybrid embedding (Dense + Sparse)
   * Used for Small chunks
   */
  async embedHybrid(text: string): Promise<HybridEmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    // Check cache
    const cacheKey = text.trim();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Generate embedding with sparse output
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
        return_sparse: true, // Enable sparse output
      });

      // Extract dense vector
      const dense = this.extractDenseVector(output);

      // Extract sparse vector (with text fallback)
      const sparse = this.extractSparseVector(output, text);

      const duration = Date.now() - startTime;
      console.log(`[HybridEmbedding] Generated hybrid embedding (${duration}ms, dense: ${dense.length}d, sparse: ${sparse.indices.length} terms)`);

      const result: HybridEmbeddingResult = {
        dense,
        sparse,
        text,
        modelId: this.modelName,
      };

      // Cache result
      if (this.embeddingCache.size < this.maxCacheSize) {
        this.embeddingCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate hybrid embedding: ${errorMessage}`);
    }
  }

  /**
   * Generate sparse-only embedding
   * Used for Parent chunks (no dense, saves storage)
   */
  async embedSparseOnly(text: string): Promise<SparseOnlyResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Generate embedding with sparse output only
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
        return_sparse: true,
      });

      // Extract sparse vector (with text fallback)
      const sparse = this.extractSparseVector(output, text);

      const duration = Date.now() - startTime;
      console.log(`[HybridEmbedding] Generated sparse-only embedding (${duration}ms, sparse: ${sparse.indices.length} terms)`);

      return {
        sparse,
        text,
        modelId: this.modelName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate sparse-only embedding: ${errorMessage}`);
    }
  }

  /**
   * Generate hybrid embeddings for batch of texts
   */
  async embedHybridBatch(texts: string[]): Promise<HybridEmbeddingResult[]> {
    if (texts.length === 0) return [];

    // Validate inputs
    for (const text of texts) {
      if (!text || text.trim().length === 0) {
        throw new Error('Cannot embed empty text in batch');
      }
    }

    await this.ensureInitialized();

    const startTime = Date.now();

    // Process in chunks to avoid memory issues
    const BATCH_SIZE = 50;
    const results: HybridEmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, Math.min(i + BATCH_SIZE, texts.length));

      for (const text of chunk) {
        const result = await this.embedHybrid(text);
        results.push(result);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[HybridEmbedding] Batch embedding complete (${texts.length} texts, ${duration}ms)`);

    return results;
  }

  /**
   * Generate sparse-only embeddings for batch
   */
  async embedSparseOnlyBatch(texts: string[]): Promise<SparseOnlyResult[]> {
    if (texts.length === 0) return [];

    await this.ensureInitialized();

    const results: SparseOnlyResult[] = [];

    for (const text of texts) {
      const result = await this.embedSparseOnly(text);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate dense-only embedding (compatibility method)
   */
  async embedDense(text: string): Promise<number[]> {
    const result = await this.embedHybrid(text);
    return result.dense;
  }

  /**
   * Generate dense-only embeddings for batch (compatibility method)
   */
  async embedDenseBatch(texts: string[]): Promise<number[][]> {
    const results = await this.embedHybridBatch(texts);
    return results.map(r => r.dense);
  }

  /**
   * Extract dense vector from model output
   */
  private extractDenseVector(output: any): number[] {
    // Handle different output formats
    if (output.dense_vec) {
      return Array.from(output.dense_vec.data as Float32Array);
    }

    if (output.data) {
      return Array.from(output.data as Float32Array);
    }

    // Fallback: try to extract from main output
    if (output.output && output.output.data) {
      return Array.from(output.output.data as Float32Array);
    }

    throw new Error('Unable to extract dense vector from model output');
  }

  /**
   * Extract sparse vector from model output
   * Falls back to tokenizer-based extraction if native sparse not available
   */
  private extractSparseVector(output: any, text?: string): SparseVector {
    const sparseMap: SparseVectorMap = {};

    // Handle different output formats
    if (output.sparse_vec) {
      // bge-m3 format: sparse_vec is an object with term-weight pairs
      const sparseData = output.sparse_vec;
      for (const [term, weight] of Object.entries(sparseData)) {
        if (typeof weight === 'number' && weight >= this.config.sparseMinWeight) {
          sparseMap[term] = weight;
        }
      }
    } else if (output.sparse_values) {
      // Alternative format: indices and values
      const indices = output.sparse_values.indices as number[];
      const values = output.sparse_values.values as number[];

      for (let i = 0; i < indices.length; i++) {
        const weight = values[i];
        if (weight && weight >= this.config.sparseMinWeight) {
          // Use index as term identifier
          sparseMap[`term_${indices[i]}`] = weight;
        }
      }
    } else if (text && this.extractor?.tokenizer) {
      // Fallback: Use tokenizer to extract lexical terms with importance weights
      // This provides BM25-style sparse vectors for keyword matching
      const tokenizerResult = this.extractor.tokenizer(text);

      if (tokenizerResult?.input_ids) {
        const inputIdsData = tokenizerResult.input_ids.data || tokenizerResult.input_ids;
        // Handle BigInt64Array or regular arrays - convert all to regular numbers
        let tokenIds: number[];
        if (Array.isArray(inputIdsData)) {
          tokenIds = inputIdsData.map(id => Number(id));
        } else if (inputIdsData instanceof BigInt64Array) {
          tokenIds = Array.from(inputIdsData).map(id => Number(id));
        } else if (inputIdsData instanceof Int32Array || inputIdsData instanceof Float32Array) {
          tokenIds = Array.from(inputIdsData);
        } else {
          // Try to convert any iterable
          tokenIds = Array.from(inputIdsData as any).map(id => Number(id));
        }

        // Count token frequencies and assign weights
        const tokenCounts = new Map<number, number>();
        for (const id of tokenIds) {
          tokenCounts.set(id, (tokenCounts.get(id) || 0) + 1);
        }

        // Calculate TF-based weights (normalized by total tokens)
        const totalTokens = tokenIds.length;
        for (const [tokenId, count] of tokenCounts) {
          // Skip special tokens (usually < 100 in most tokenizers)
          if (tokenId < 100) continue;

          // TF weight: count / totalTokens, boosted for rare terms
          const tfWeight = count / totalTokens;

          // Get the actual token string for the key
          try {
            const tokenStr = this.extractor.tokenizer.decode([tokenId], { skip_special_tokens: true });
            if (tokenStr && tokenStr.trim() && tfWeight >= this.config.sparseMinWeight) {
              sparseMap[tokenStr.trim().toLowerCase()] = Math.min(tfWeight * 2, 1.0); // Boost TF weight
            }
          } catch {
            // If decode fails, use tokenId as key
            sparseMap[`tok_${tokenId}`] = tfWeight;
          }
        }
      }
    }

    // Filter low weight terms and limit max terms
    const filteredTerms = Object.entries(sparseMap)
      .filter(([_, weight]) => weight >= this.config.sparseMinWeight)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.sparseMaxTerms);

    // Convert to SparseVector format
    const indices: number[] = [];
    const values: number[] = [];

    for (const [term, weight] of filteredTerms) {
      const index = this.termMapper.getIndex(term);
      indices.push(index);
      values.push(weight);
    }

    return { indices, values };
  }

  /**
   * Get term mapper statistics
   */
  getTermMapperStats(): { termCount: number } {
    return this.termMapper.getStats();
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    console.log('[HybridEmbedding] Cache cleared');
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
}

/**
 * Create hybrid embedding service
 */
export function createHybridEmbeddingService(modelName?: string): HybridEmbeddingService {
  return new HybridEmbeddingService(modelName);
}

/**
 * Get global term mapper (for consistent sparse indexing)
 */
export function getGlobalTermMapper(): TermIndexMapper {
  return globalTermMapper;
}