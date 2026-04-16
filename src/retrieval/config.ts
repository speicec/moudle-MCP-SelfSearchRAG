/**
 * Enhanced Retrieval Configuration
 *
 * Configuration for query optimization, dynamic topK, and reranking layers.
 */

/**
 * Model context window presets
 */
export type ModelContextWindow = 32000 | 64000 | 128000;

/**
 * Confidence calculation weights
 */
export interface ConfidenceWeights {
  similarity: number;     // weight for similarity score (default: 0.5)
  keywordMatch: number;   // weight for keyword match score (default: 0.2)
  position: number;       // weight for position score (default: 0.1)
  chunkQuality: number;   // weight for chunk quality score (default: 0.2)
}

/**
 * Enhanced retrieval configuration
 */
export interface EnhancedRetrievalConfig {
  // Model context window
  modelContextWindow: ModelContextWindow;

  // Dynamic topK configuration
  systemPromptTokens: number;
  outputReservation: number;
  fillRatio: number;
  overfetchRatio: number;

  // Confidence thresholds
  minConfidenceThreshold: number;
  confidenceWeights: ConfidenceWeights;

  // Reranker configuration
  rerankerThreshold: number;
  localRerankerModel: string;

  // Query optimization
  enableDecomposition: boolean;
  maxSubQueries: number;
  enableExpansion: boolean;
  maxExpandedTerms: number;
  enableRewrite: boolean;

  // Cache configuration
  queryCacheTTL: number;
  analysisCacheTTL: number;

  // LLM timeouts
  queryAnalysisTimeoutMs: number;
  queryRewriteTimeoutMs: number;
  queryDecomposeTimeoutMs: number;
}

/**
 * Default confidence weights
 */
export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  similarity: 0.5,
  keywordMatch: 0.2,
  position: 0.1,
  chunkQuality: 0.2,
};

/**
 * Default enhanced retrieval configuration
 */
export const DEFAULT_ENHANCED_RETRIEVAL_CONFIG: EnhancedRetrievalConfig = {
  modelContextWindow: 64000,

  systemPromptTokens: 500,
  outputReservation: 12000,
  fillRatio: 0.6,
  overfetchRatio: 1.5,

  minConfidenceThreshold: 0.3,
  confidenceWeights: DEFAULT_CONFIDENCE_WEIGHTS,

  rerankerThreshold: 20,
  localRerankerModel: 'bge-reranker-v2-m3',

  enableDecomposition: true,
  maxSubQueries: 5,
  enableExpansion: true,
  maxExpandedTerms: 5,
  enableRewrite: true,

  queryCacheTTL: 300000,    // 5 minutes
  analysisCacheTTL: 300000, // 5 minutes

  queryAnalysisTimeoutMs: 2000,
  queryRewriteTimeoutMs: 2000,
  queryDecomposeTimeoutMs: 3000,
};

/**
 * Context window presets
 */
export const CONTEXT_WINDOW_PRESETS = {
  light: {
    modelContextWindow: 32000,
    systemPromptTokens: 500,
    outputReservation: 8000,
    fillRatio: 0.6,
    overfetchRatio: 1.5,
  },
  standard: {
    modelContextWindow: 64000,
    systemPromptTokens: 500,
    outputReservation: 12000,
    fillRatio: 0.6,
    overfetchRatio: 1.5,
  },
  extended: {
    modelContextWindow: 128000,
    systemPromptTokens: 500,
    outputReservation: 24000,
    fillRatio: 0.6,
    overfetchRatio: 1.5,
  },
} as const;

/**
 * Merge user config with defaults
 */
export function mergeEnhancedRetrievalConfig(
  userConfig?: Partial<EnhancedRetrievalConfig>
): EnhancedRetrievalConfig {
  if (!userConfig) {
    return DEFAULT_ENHANCED_RETRIEVAL_CONFIG;
  }

  return {
    modelContextWindow: userConfig.modelContextWindow ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.modelContextWindow,
    systemPromptTokens: userConfig.systemPromptTokens ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.systemPromptTokens,
    outputReservation: userConfig.outputReservation ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.outputReservation,
    fillRatio: userConfig.fillRatio ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.fillRatio,
    overfetchRatio: userConfig.overfetchRatio ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.overfetchRatio,

    minConfidenceThreshold: userConfig.minConfidenceThreshold ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.minConfidenceThreshold,
    confidenceWeights: {
      ...DEFAULT_CONFIDENCE_WEIGHTS,
      ...userConfig.confidenceWeights,
    },

    rerankerThreshold: userConfig.rerankerThreshold ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.rerankerThreshold,
    localRerankerModel: userConfig.localRerankerModel ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.localRerankerModel,

    enableDecomposition: userConfig.enableDecomposition ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.enableDecomposition,
    maxSubQueries: userConfig.maxSubQueries ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.maxSubQueries,
    enableExpansion: userConfig.enableExpansion ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.enableExpansion,
    maxExpandedTerms: userConfig.maxExpandedTerms ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.maxExpandedTerms,
    enableRewrite: userConfig.enableRewrite ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.enableRewrite,

    queryCacheTTL: userConfig.queryCacheTTL ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.queryCacheTTL,
    analysisCacheTTL: userConfig.analysisCacheTTL ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.analysisCacheTTL,

    queryAnalysisTimeoutMs: userConfig.queryAnalysisTimeoutMs ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.queryAnalysisTimeoutMs,
    queryRewriteTimeoutMs: userConfig.queryRewriteTimeoutMs ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.queryRewriteTimeoutMs,
    queryDecomposeTimeoutMs: userConfig.queryDecomposeTimeoutMs ?? DEFAULT_ENHANCED_RETRIEVAL_CONFIG.queryDecomposeTimeoutMs,
  };
}

/**
 * Validate configuration parameters
 */
export function validateEnhancedRetrievalConfig(config: EnhancedRetrievalConfig): boolean {
  // Context window validation
  if (![32000, 64000, 128000].includes(config.modelContextWindow)) {
    throw new Error('modelContextWindow must be 32000, 64000, or 128000');
  }

  // Fill ratio validation
  if (config.fillRatio < 0.3 || config.fillRatio > 0.8) {
    throw new Error('fillRatio must be in range [0.3, 0.8]');
  }

  // Overfetch ratio validation
  if (config.overfetchRatio < 1.0 || config.overfetchRatio > 3.0) {
    throw new Error('overfetchRatio must be in range [1.0, 3.0]');
  }

  // Confidence threshold validation
  if (config.minConfidenceThreshold < 0.1 || config.minConfidenceThreshold > 0.5) {
    throw new Error('minConfidenceThreshold must be in range [0.1, 0.5]');
  }

  // Confidence weights must sum to 1
  const weightSum = Object.values(config.confidenceWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.01) {
    throw new Error('confidenceWeights must sum to 1');
  }

  // Reranker threshold validation
  if (config.rerankerThreshold < 10 || config.rerankerThreshold > 50) {
    throw new Error('rerankerThreshold must be in range [10, 50]');
  }

  // Sub queries validation
  if (config.maxSubQueries < 1 || config.maxSubQueries > 10) {
    throw new Error('maxSubQueries must be in range [1, 10]');
  }

  // Expanded terms validation
  if (config.maxExpandedTerms < 1 || config.maxExpandedTerms > 10) {
    throw new Error('maxExpandedTerms must be in range [1, 10]');
  }

  return true;
}

/**
 * TopK calculation result
 */
export interface TopKResult {
  coarseTopK: number;
  targetTokens: number;
  effectiveWindow: number;
}