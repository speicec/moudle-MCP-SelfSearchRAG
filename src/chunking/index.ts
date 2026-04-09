// Chunking module - semantic chunking with hierarchical retrieval
//
// This module implements intelligent document chunking using:
// 1. Semantic boundaries detected via embedding similarity cliffs
// 2. Hierarchical structure: small chunks for retrieval, parent chunks for context
// 3. Quality filtering to exclude low-value content
// 4. Small-to-Big retrieval strategy

// Types
export type {
  ChunkLevel,
  QualityFilterMode,
  ChunkContentType,
  ChunkPosition,
  QualityDimensions,
  QualityScore,
  HierarchicalChunk,
  ChunkMetadata,
  SemanticCliff,
  CliffDetectionResult,
  SentenceEmbedding,
  WindowEmbedding,
  HierarchicalRetrievalResult,
  AssembledContext,
} from './types.js';

export {
  createHierarchicalChunk,
  createDefaultQualityScore,
  isSmallChunk,
  isParentChunk,
} from './types.js';

// Configuration
export type {
  CliffDetectionConfig,
  SemanticChunkerConfig,
  QualityFilterConfig,
  QualityDimensionWeights,
  SmallToBigRetrievalConfig,
  ChunkingConfig,
} from './config.js';

export {
  DEFAULT_CLIFF_DETECTION_CONFIG,
  DEFAULT_SEMANTIC_CHUNKER_CONFIG,
  DEFAULT_QUALITY_FILTER_CONFIG,
  DEFAULT_RETRIEVAL_CONFIG,
  DEFAULT_CHUNKING_CONFIG,
  mergeChunkingConfig,
  validateChunkingConfig,
} from './config.js';

// Utilities
export {
  cosineSimilarity,
  adjacentSimilarity,
  similarityGradient,
  aggregateEmbeddings,
  estimateTokenCount,
  splitIntoSentences,
  splitIntoParagraphs,
  isCompleteSentence,
  countUniqueTokens,
  calculateRepetitionRatio,
  mergeChunks,
  truncateToTokens,
  deduplicateById,
  sortBySimilarity,
} from './utils.js';

// Cliff Detector
export { CliffDetector, createCliffDetector } from './cliff-detector.js';

// Semantic Chunker
export type { EmbeddingService } from './semantic-chunker.js';
export { SemanticChunker, createSemanticChunker } from './semantic-chunker.js';

// Hierarchical Store
export { HierarchicalStore, createHierarchicalStore } from './hierarchical-store.js';

// Quality Filter
export { ChunkQualityFilter, createChunkQualityFilter } from './quality-filter.js';

// Small-to-Big Retriever
export { SmallToBigRetriever, createSmallToBigRetriever } from './small-to-big-retriever.js';

/**
 * Complete chunking pipeline
 */
import type { ChunkingConfig } from './config.js';
import { DEFAULT_CHUNKING_CONFIG, mergeChunkingConfig } from './config.js';
import { SemanticChunker, createSemanticChunker } from './semantic-chunker.js';
import { HierarchicalStore, createHierarchicalStore } from './hierarchical-store.js';
import { ChunkQualityFilter, createChunkQualityFilter } from './quality-filter.js';
import { SmallToBigRetriever, createSmallToBigRetriever } from './small-to-big-retriever.js';
import type { HierarchicalChunk, HierarchicalRetrievalResult, AssembledContext } from './types.js';

export interface ChunkingPipeline {
  chunk(text: string, documentId: string): Promise<HierarchicalChunk[]>;
  retrieve(query: string): Promise<HierarchicalRetrievalResult[]>;
  retrieveWithContext(query: string): Promise<{
    results: HierarchicalRetrievalResult[];
    context: AssembledContext;
  }>;
  getStore(): HierarchicalStore;
  clear(): void;
}

/**
 * Create a complete chunking pipeline
 */
export function createChunkingPipeline(
  config?: Partial<ChunkingConfig>
): ChunkingPipeline {
  const mergedConfig = mergeChunkingConfig(config);

  const chunker = createSemanticChunker(mergedConfig.semanticChunker);
  const store = createHierarchicalStore(mergedConfig.semanticChunker);
  const qualityFilter = createChunkQualityFilter(mergedConfig.qualityFilter);
  const retriever = createSmallToBigRetriever(store, mergedConfig.retrieval);

  return {
    async chunk(text: string, documentId: string): Promise<HierarchicalChunk[]> {
      // Step 1: Semantic chunking
      const rawChunks = await chunker.chunk(text, documentId);

      // Step 2: Build hierarchy
      const hierarchicalChunks = await store.buildHierarchy(rawChunks, documentId);

      // Step 3: Quality filtering
      const filteredChunks = qualityFilter.process(hierarchicalChunks);

      return filteredChunks;
    },

    async retrieve(query: string): Promise<HierarchicalRetrievalResult[]> {
      return retriever.retrieve(query);
    },

    async retrieveWithContext(query: string): Promise<{
      results: HierarchicalRetrievalResult[];
      context: AssembledContext;
    }> {
      const results = await retriever.retrieve(query);
      const context = retriever.assembleContext(results);
      return { results, context };
    },

    getStore(): HierarchicalStore {
      return store;
    },

    clear(): void {
      store.clear();
      chunker.clearCache();
      retriever.clearCache();
    },
  };
}