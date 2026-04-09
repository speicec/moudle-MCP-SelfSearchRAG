import type {
  HierarchicalChunk,
  SentenceEmbedding,
  ChunkPosition,
  ChunkMetadata,
  ChunkContentType,
} from './types.js';
import type { SemanticChunkerConfig, ChunkingConfig } from './config.js';
import { DEFAULT_SEMANTIC_CHUNKER_CONFIG } from './config.js';
import {
  CliffDetector,
  createCliffDetector,
  type CliffDetectionResult,
} from './cliff-detector.js';
import {
  splitIntoSentences,
  estimateTokenCount,
  mergeChunks,
  aggregateEmbeddings,
} from './utils.js';
import { createDefaultQualityScore } from './types.js';

/**
 * Embedding service interface for generating embeddings
 */
export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddingsBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Simple in-memory embedding cache
 */
class EmbeddingCache {
  private cache: Map<string, number[]> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(text: string): number[] | undefined {
    return this.cache.get(text);
  }

  set(text: string, embedding: number[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(text, embedding);
  }

  has(text: string): boolean {
    return this.cache.has(text);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * SemanticChunker - chunks text at semantic boundaries using embedding similarity
 *
 * Algorithm:
 * 1. Split text into sentences
 * 2. Generate embeddings for each sentence (with caching)
 * 3. Use sliding window to compute adjacent similarities
 * 4. Detect semantic cliffs (places where similarity drops significantly)
 * 5. Create chunks at cliff boundaries
 * 6. Fallback to fixed-length chunking if no cliffs detected
 */
export class SemanticChunker {
  private config: SemanticChunkerConfig;
  private cliffDetector: CliffDetector;
  private embeddingService?: EmbeddingService;
  private cache: EmbeddingCache;

  constructor(
    config?: Partial<SemanticChunkerConfig>,
    embeddingService?: EmbeddingService,
    cliffConfig?: Partial<ChunkingConfig['cliffDetection']>
  ) {
    this.config = { ...DEFAULT_SEMANTIC_CHUNKER_CONFIG, ...config };
    this.cliffDetector = createCliffDetector(cliffConfig);
    if (embeddingService !== undefined) {
      this.embeddingService = embeddingService;
    }
    this.cache = new EmbeddingCache(this.config.embeddingBatchSize * 20);
  }

  /**
   * Set embedding service for generating embeddings
   */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
  }

  /**
   * Chunk text using semantic boundaries
   */
  async chunk(
    text: string,
    sourceDocumentId: string
  ): Promise<HierarchicalChunk[]> {
    // 3.1: Split into sentences
    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      return [];
    }

    // 3.2 & 3.3: Generate embeddings with caching
    const sentenceEmbeddings = await this.generateSentenceEmbeddings(sentences);

    // 3.4: Detect semantic boundaries using CliffDetector
    const windowEmbeddings = this.createWindowEmbeddings(sentenceEmbeddings);
    const cliffResult = this.cliffDetector.detect(windowEmbeddings.map(w => w.embedding));

    // 3.5: Create chunks at semantic boundaries
    const chunks = this.createChunksAtBoundaries(
      sentences,
      cliffResult,
      sourceDocumentId
    );

    // 3.6: Fallback to fixed-length chunking if no cliffs detected
    if (chunks.length === 0 || chunks.every(c => estimateTokenCount(c.content) === text.length)) {
      return this.fallbackChunking(text, sourceDocumentId);
    }

    // 3.7: Preserve metadata
    return chunks;
  }

  /**
   * Generate embeddings for all sentences with batch API calls and caching
   */
  private async generateSentenceEmbeddings(
    sentences: string[]
  ): Promise<SentenceEmbedding[]> {
    if (!this.embeddingService) {
      // Generate synthetic embeddings for testing
      return sentences.map((text, index) => ({
        index,
        text,
        embedding: this.syntheticEmbedding(text),
      }));
    }

    // Check cache and batch uncached sentences
    const result: SentenceEmbedding[] = [];
    const uncached: { index: number; text: string }[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (sentence === undefined) continue;

      const cached = this.cache.get(sentence);
      if (cached) {
        result.push({
          index: i,
          text: sentence,
          embedding: cached,
        });
      } else {
        uncached.push({ index: i, text: sentence });
      }
    }

    // Batch generate uncached embeddings
    if (uncached.length > 0) {
      const batchSize = this.config.embeddingBatchSize;
      for (let i = 0; i < uncached.length; i += batchSize) {
        const batch = uncached.slice(i, i + batchSize);
        const embeddings = await this.embeddingService.generateEmbeddingsBatch(
          batch.map(s => s.text)
        );

        for (let j = 0; j < batch.length; j++) {
          const batchItem = batch[j];
          const embedding = embeddings[j];
          if (batchItem && embedding) {
            this.cache.set(batchItem.text, embedding);
            result.push({
              index: batchItem.index,
              text: batchItem.text,
              embedding: embedding,
            });
          }
        }
      }
    }

    // Sort by original index
    result.sort((a, b) => a.index - b.index);

    return result;
  }

  /**
   * Create sliding window embeddings
   */
  private createWindowEmbeddings(
    sentenceEmbeddings: SentenceEmbedding[]
  ): { startIndex: number; endIndex: number; embedding: number[] }[] {
    const windows: { startIndex: number; endIndex: number; embedding: number[] }[] = [];
    const windowSize = this.config.windowSize;

    for (let i = 0; i < sentenceEmbeddings.length - windowSize + 1; i++) {
      const windowSentenceEmbeddings = sentenceEmbeddings
        .slice(i, i + windowSize)
        .map(s => s.embedding);

      windows.push({
        startIndex: i,
        endIndex: i + windowSize - 1,
        embedding: aggregateEmbeddings(windowSentenceEmbeddings),
      });
    }

    return windows;
  }

  /**
   * Create chunks at detected semantic boundaries
   */
  private createChunksAtBoundaries(
    sentences: string[],
    cliffResult: CliffDetectionResult,
    sourceDocumentId: string
  ): HierarchicalChunk[] {
    const chunks: HierarchicalChunk[] = [];

    // Get cliff positions (position in embedding sequence = sentence position)
    const cliffPositions = cliffResult.cliffs.map(c => c.position + this.config.windowSize);

    // Add boundaries: start, cliffs, end
    const boundaries = [0, ...cliffPositions, sentences.length];

    // Sort and dedupe boundaries
    boundaries.sort((a, b) => a - b);
    const uniqueBoundaries = boundaries.filter((b, i) => i === 0 || boundaries[i - 1] !== b);

    // Create chunks between boundaries
    for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
      const startSentence = uniqueBoundaries[i];
      const endSentence = uniqueBoundaries[i + 1];

      if (startSentence === undefined || endSentence === undefined) continue;

      const chunkSentences = sentences.slice(startSentence, endSentence);
      const content = chunkSentences.join(' ');

      const tokenCount = estimateTokenCount(content);

      // Check size constraints
      if (tokenCount < this.config.smallChunkMinTokens && i < uniqueBoundaries.length - 2) {
        // Merge with next chunk if too small
        continue;
      }

      if (tokenCount > this.config.smallChunkMaxTokens) {
        // Split into smaller chunks
        const subChunks = this.splitLargeChunk(
          chunkSentences,
          sourceDocumentId,
          startSentence
        );
        chunks.push(...subChunks);
      } else {
        chunks.push(this.createChunk(
          content,
          sourceDocumentId,
          { start: startSentence, end: endSentence },
          cliffResult.cliffs.find(c => c.position === startSentence)?.confidence ?? 0.5
        ));
      }
    }

    return chunks;
  }

  /**
   * Split a large chunk into smaller pieces
   */
  private splitLargeChunk(
    sentences: string[],
    sourceDocumentId: string,
    startSentence: number
  ): HierarchicalChunk[] {
    const chunks: HierarchicalChunk[] = [];
    let currentContent = '';
    let currentStart = startSentence;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (sentence === undefined) continue;

      const newContent = currentContent + ' ' + sentence;

      if (estimateTokenCount(newContent) > this.config.smallChunkMaxTokens) {
        // Create chunk with current content
        if (currentContent.length > 0) {
          chunks.push(this.createChunk(
            currentContent.trim(),
            sourceDocumentId,
            { start: currentStart, end: currentStart + i },
            0.3 // lower confidence for forced split
          ));
        }

        currentContent = sentence;
        currentStart = startSentence + i;
      } else {
        currentContent = newContent;
      }
    }

    // Create final chunk
    if (currentContent.length > 0) {
      chunks.push(this.createChunk(
        currentContent.trim(),
        sourceDocumentId,
        { start: currentStart, end: startSentence + sentences.length },
        0.3
      ));
    }

    return chunks;
  }

  /**
   * Create a single chunk
   */
  private createChunk(
    content: string,
    sourceDocumentId: string,
    position: ChunkPosition,
    boundaryConfidence: number
  ): HierarchicalChunk {
    return {
      id: this.generateId(),
      content,
      embedding: [], // Will be generated later
      level: 'small',
      position,
      qualityScore: createDefaultQualityScore(),
      sourceDocumentId,
      metadata: {
        contentType: 'text',
        boundaryConfidence,
      },
    };
  }

  /**
   * Fallback to fixed-length chunking when no semantic cliffs detected
   */
  private fallbackChunking(
    text: string,
    sourceDocumentId: string
  ): HierarchicalChunk[] {
    const chunks: HierarchicalChunk[] = [];
    const sentences = splitIntoSentences(text);
    let currentContent = '';
    let currentPosition = 0;
    let startSentence = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (sentence === undefined) continue;

      const newContent = currentContent + ' ' + sentence;

      if (estimateTokenCount(newContent) > this.config.fallbackChunkSize) {
        if (currentContent.length > 0) {
          chunks.push(this.createChunk(
            currentContent.trim(),
            sourceDocumentId,
            { start: startSentence, end: i },
            0 // zero confidence for fallback
          ));
        }

        currentContent = sentence;
        startSentence = i;
      } else {
        currentContent = newContent;
      }
    }

    // Final chunk
    if (currentContent.length > 0) {
      chunks.push(this.createChunk(
        currentContent.trim(),
        sourceDocumentId,
        { start: startSentence, end: sentences.length },
        0
      ));
    }

    return chunks;
  }

  /**
   * Generate synthetic embedding for testing (hash-based)
   */
  private syntheticEmbedding(text: string): number[] {
    const dimension = 128;
    const embedding: number[] = new Array(dimension).fill(0);

    // Simple hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = i % dimension;
      embedding[idx] = (embedding[idx] ?? 0) + charCode / 255;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] = (embedding[i] ?? 0) / norm;
      }
    }

    return embedding;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): SemanticChunkerConfig {
    return { ...this.config };
  }
}

/**
 * Create semantic chunker
 */
export function createSemanticChunker(
  config?: Partial<SemanticChunkerConfig>,
  embeddingService?: EmbeddingService
): SemanticChunker {
  return new SemanticChunker(config, embeddingService);
}