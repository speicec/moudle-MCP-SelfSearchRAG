/**
 * Enhanced Retrieval Types
 *
 * Type definitions for query optimization, reranking, and confidence scoring.
 */

import type { ConfidenceWeights, ModelContextWindow, TopKResult } from './config.js';

/**
 * Query complexity levels
 */
export type QueryComplexity = 'simple' | 'complex' | 'structured';

/**
 * Query analysis result from LLM
 */
export interface QueryAnalysisResult {
  complexity: QueryComplexity;
  needsDecomposition: boolean;
  needsRewrite: boolean;
  detectedFilters?: Record<string, string | number>;
  suggestedSubQueries?: string[] | undefined;
  rewrittenQuery?: string | undefined;
  analysisTimestamp: number;
}

/**
 * Query optimization output
 */
export interface QueryOptimizationOutput {
  originalQuery: string;
  rewrittenQuery?: string;
  subQueries?: string[];
  expandedTerms: string[];
  complexity: QueryComplexity;
  detectedFilters?: Record<string, string | number>;
}

/**
 * Query decomposition result
 */
export interface DecompositionResult {
  originalQuery: string;
  subQueries: string[];
  strategy: 'parallel' | 'sequential';
}

/**
 * Query DSL for structured filtering
 */
export interface QueryDSL {
  textQuery: string;
  filters: Array<{
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
    value: string | number | string[];
  }>;
  sortBy?: { field: string; order: 'asc' | 'desc' };
}

/**
 * Expansion configuration
 */
export interface ExpansionConfig {
  maxExpandedTerms: number;
  synonymDictionaryPath: string;
  domainTermsPath?: string;
}

/**
 * Retrieval result with confidence score
 */
export interface ConfidenceRetrievalResult {
  // Original retrieval fields
  smallChunkId: string;
  parentChunkId: string;
  smallChunkContent: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
  metadata: {
    contentType: string;
    pageNumber?: number;
    section?: string;
    boundaryConfidence?: number;
  };
  expandedFromSmallChunk: boolean;
  contextWindow?: string;
  windowStart?: number;
  windowEnd?: number;

  // Enhanced confidence fields
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  keywordMatchScore: number;
  positionScore: number;
  chunkQualityScore: number;
}

/**
 * Context with confidence metadata
 */
export interface ContextWithConfidence {
  content: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  source: string;
  page: number | undefined;
  section: string | undefined;
}

/**
 * Assembled context with confidence
 */
export interface EnhancedAssembledContext {
  chunks: ContextWithConfidence[];
  totalTokens: number;
  truncated: boolean;
  avgConfidence: number;
}

/**
 * Reranking input
 */
export interface RerankingInput {
  query: string;
  results: ConfidenceRetrievalResult[];
}

/**
 * Reranking output
 */
export interface RerankingOutput {
  results: ConfidenceRetrievalResult[];
  scores: number[];
  method: 'local-reranker' | 'internal-confidence';
}

/**
 * Local rerank result from BGE model
 */
export interface LocalRerankResult {
  index: number;
  score: number;
}

/**
 * No match result for low confidence
 */
export interface NoMatchResult {
  status: 'no_match';
  message: string;
  suggestions: string[];
}

/**
 * Enhanced chat response
 */
export interface EnhancedChatResponse {
  query: string;
  results: ConfidenceRetrievalResult[];

  // Query analysis metadata
  queryAnalysis: {
    complexity: QueryComplexity;
    wasRewritten: boolean;
    wasDecomposed: boolean;
    expandedTerms: string[];
  };

  // Retrieval statistics
  retrievalStats: {
    coarseTopK: number;
    refinedCount: number;
    avgConfidence: number;
    truncated: boolean;
    method: 'local-reranker' | 'internal-confidence';
  };

  // Context with confidence
  context: EnhancedAssembledContext;

  // LLM generation
  answer: string;
  thinking: string;
}

/**
 * Cache entry for query analysis
 */
export interface QueryAnalysisCacheEntry {
  result: QueryAnalysisResult;
  timestamp: number;
  ttl: number;
}

/**
 * Synonym dictionary entry
 */
export interface SynonymDictionary {
  [key: string]: string[];
}

/**
 * Reranker configuration
 */
export interface RerankerConfig {
  threshold: number;
  localModel: string;
  modelPath?: string;
}

/**
 * Confidence calculation weights (re-export for convenience)
 */
export type { ConfidenceWeights } from './config.js';

/**
 * TopK calculation result (re-export for convenience)
 */
export type { TopKResult } from './config.js';

/**
 * Model context window type (re-export for convenience)
 */
export type { ModelContextWindow } from './config.js';

/**
 * Dynamic TopK input
 */
export interface DynamicTopKInput {
  modelContextWindow: ModelContextWindow;
  avgParentTokens: number;
}

/**
 * Confidence level thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.7,
  medium: 0.5,
  low: 0.3,
} as const;

/**
 * Determine confidence level from score
 */
export function determineConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Create default confidence retrieval result
 */
export function createDefaultConfidenceResult(
  baseResult: {
    smallChunkId: string;
    parentChunkId: string;
    smallChunkContent: string;
    parentChunkContent: string;
    similarityScore: number;
    sourceDocumentId: string;
    metadata: {
      contentType: string;
      pageNumber?: number;
      section?: string;
      boundaryConfidence?: number;
    };
    expandedFromSmallChunk: boolean;
    qualityScore?: {
      composite: number;
      dimensions: {
        informationDensity: number;
        repetitionRatio: number;
        semanticCompleteness: number;
        documentRelevance: number;
      };
      evaluatedAt: Date;
    } | undefined;
  }
): ConfidenceRetrievalResult {
  // Extract chunk quality score from evaluation result
  // If qualityScore exists, use its composite value
  // Otherwise fallback to 0 (will be handled by ConfidenceCalculator)
  const chunkQualityScore = baseResult.qualityScore?.composite ?? 0;

  return {
    ...baseResult,
    confidenceScore: baseResult.similarityScore,
    confidenceLevel: determineConfidenceLevel(baseResult.similarityScore),
    keywordMatchScore: 0,
    positionScore: 0,
    chunkQualityScore,
  };
}