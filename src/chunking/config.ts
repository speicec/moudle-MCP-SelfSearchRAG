import type { QualityFilterMode } from './types.js';

/**
 * Cliff detection configuration
 */
export interface CliffDetectionConfig {
  similarityThreshold: number;   // threshold below which cliff candidate is identified
  gradientThreshold: number;     // minimum gradient for cliff confirmation
  minCliffWidth: number;         // minimum cliff width for noise filtering
  highConfidenceThreshold: number; // threshold for high-quality cliff
}

/**
 * Semantic chunker configuration
 */
export interface SemanticChunkerConfig {
  windowSize: number;            // number of sentences in sliding window
  smallChunkMinTokens: number;   // minimum tokens for small chunk
  smallChunkMaxTokens: number;   // maximum tokens for small chunk
  parentChunkMinTokens: number;  // minimum tokens for parent chunk
  parentChunkMaxTokens: number;  // maximum tokens for parent chunk
  fallbackChunkSize: number;     // fallback chunk size when no cliffs detected
  embeddingBatchSize: number;    // batch size for embedding API calls
}

/**
 * Quality filter configuration
 */
export interface QualityFilterConfig {
  qualityThreshold: number;      // threshold below which chunk is low-quality
  filterMode: QualityFilterMode; // discard, merge, or flag
  dimensionWeights: QualityDimensionWeights;
}

/**
 * Quality dimension weights
 */
export interface QualityDimensionWeights {
  informationDensity: number;    // weight for information density score
  repetitionRatio: number;       // weight for repetition ratio score (inverse)
  semanticCompleteness: number;  // weight for semantic completeness score
  documentRelevance: number;     // weight for document relevance score
}

/**
 * Small-to-Big retrieval configuration
 */
export interface SmallToBigRetrievalConfig {
  topK: number;                  // number of small chunks to retrieve
  similarityThreshold: number;   // minimum similarity for result inclusion
  maxContextTokens: number;      // maximum tokens in assembled context
  enableFallback: boolean;       // enable fallback to direct parent search
  fallbackThreshold: number;     // confidence threshold for fallback trigger
}

/**
 * Complete chunking configuration
 */
export interface ChunkingConfig {
  cliffDetection: CliffDetectionConfig;
  semanticChunker: SemanticChunkerConfig;
  qualityFilter: QualityFilterConfig;
  retrieval: SmallToBigRetrievalConfig;
}

/**
 * Default cliff detection configuration
 */
export const DEFAULT_CLIFF_DETECTION_CONFIG: CliffDetectionConfig = {
  similarityThreshold: 0.7,
  gradientThreshold: 0.15,
  minCliffWidth: 2,
  highConfidenceThreshold: 0.8,
};

/**
 * Default semantic chunker configuration
 */
export const DEFAULT_SEMANTIC_CHUNKER_CONFIG: SemanticChunkerConfig = {
  windowSize: 3,
  smallChunkMinTokens: 100,
  smallChunkMaxTokens: 300,
  parentChunkMinTokens: 500,
  parentChunkMaxTokens: 1500,
  fallbackChunkSize: 256,
  embeddingBatchSize: 50,
};

/**
 * Default quality filter configuration
 */
export const DEFAULT_QUALITY_FILTER_CONFIG: QualityFilterConfig = {
  qualityThreshold: 0.3,
  filterMode: 'flag',
  dimensionWeights: {
    informationDensity: 0.25,
    repetitionRatio: 0.20,
    semanticCompleteness: 0.25,
    documentRelevance: 0.30,
  },
};

/**
 * Default retrieval configuration
 */
export const DEFAULT_RETRIEVAL_CONFIG: SmallToBigRetrievalConfig = {
  topK: 10,
  similarityThreshold: 0.5,
  maxContextTokens: 4000,
  enableFallback: true,
  fallbackThreshold: 0.3,
};

/**
 * Default complete configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  cliffDetection: DEFAULT_CLIFF_DETECTION_CONFIG,
  semanticChunker: DEFAULT_SEMANTIC_CHUNKER_CONFIG,
  qualityFilter: DEFAULT_QUALITY_FILTER_CONFIG,
  retrieval: DEFAULT_RETRIEVAL_CONFIG,
};

/**
 * Merge user config with defaults
 */
export function mergeChunkingConfig(
  userConfig?: Partial<ChunkingConfig>
): ChunkingConfig {
  if (!userConfig) {
    return DEFAULT_CHUNKING_CONFIG;
  }

  return {
    cliffDetection: {
      ...DEFAULT_CLIFF_DETECTION_CONFIG,
      ...userConfig.cliffDetection,
    },
    semanticChunker: {
      ...DEFAULT_SEMANTIC_CHUNKER_CONFIG,
      ...userConfig.semanticChunker,
    },
    qualityFilter: {
      ...DEFAULT_QUALITY_FILTER_CONFIG,
      ...userConfig.qualityFilter,
    },
    retrieval: {
      ...DEFAULT_RETRIEVAL_CONFIG,
      ...userConfig.retrieval,
    },
  };
}

/**
 * Validate configuration parameters
 */
export function validateChunkingConfig(config: ChunkingConfig): boolean {
  // Cliff detection validation
  if (config.cliffDetection.similarityThreshold < 0 || config.cliffDetection.similarityThreshold > 1) {
    throw new Error('similarityThreshold must be in range [0, 1]');
  }
  if (config.cliffDetection.gradientThreshold < 0 || config.cliffDetection.gradientThreshold > 1) {
    throw new Error('gradientThreshold must be in range [0, 1]');
  }
  if (config.cliffDetection.minCliffWidth < 1) {
    throw new Error('minCliffWidth must be >= 1');
  }

  // Semantic chunker validation
  if (config.semanticChunker.windowSize < 1) {
    throw new Error('windowSize must be >= 1');
  }
  if (config.semanticChunker.smallChunkMinTokens > config.semanticChunker.smallChunkMaxTokens) {
    throw new Error('smallChunkMinTokens must be <= smallChunkMaxTokens');
  }
  if (config.semanticChunker.parentChunkMinTokens > config.semanticChunker.parentChunkMaxTokens) {
    throw new Error('parentChunkMinTokens must be <= parentChunkMaxTokens');
  }

  // Quality filter validation
  if (config.qualityFilter.qualityThreshold < 0 || config.qualityFilter.qualityThreshold > 1) {
    throw new Error('qualityThreshold must be in range [0, 1]');
  }

  // Dimension weights must sum to 1
  const weightSum = Object.values(config.qualityFilter.dimensionWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.01) {
    throw new Error('dimensionWeights must sum to 1');
  }

  // Retrieval validation
  if (config.retrieval.topK < 1) {
    throw new Error('topK must be >= 1');
  }
  if (config.retrieval.maxContextTokens < 1) {
    throw new Error('maxContextTokens must be >= 1');
  }

  return true;
}